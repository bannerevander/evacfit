// Supabase backend (VITE_DATA_MODE=supabase). Reads go through RLS; every domain write is one Postgres RPC
// (supabase/migrations/*_rpc.sql), which also owns matching, capacity locks and soft-lock expiry.
import { createClient } from '@supabase/supabase-js'
import type { AlertMsg, Assignment, DisasterEvent, Family, LatLng, OutboxItem, Role, Shelter, UnmetNeed, Volunteer } from '../types'
import type { Action, Alert, State } from './store'

export const dataMode: 'demo' | 'supabase' = import.meta.env.VITE_DATA_MODE === 'supabase' ? 'supabase' : 'demo'

export const supabase = dataMode === 'supabase'
  ? createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY)
  : null

export interface Profile {
  role: Role
  displayName: string
  shelterId?: string
  volunteerId?: string
  /** Operation area (RISET §3.1): one BPBD / county / municipality, with its country's settings. */
  area?: { id: string; name: string; center: LatLng }
  country?: { code: string; emergencyNumber: string; serviceLanguages: string[] }
}

type Row = Record<string, unknown>

/** snake_case columns -> the camelCase fields in types.ts; null -> undefined like the demo store. */
function camel(row: Row): Row {
  const out: Row = {}
  for (const [k, v] of Object.entries(row)) {
    if (k === 'geog' || v === null) continue
    out[k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())] = v
  }
  return out
}

function must<T>({ data, error }: { data: T | null; error: { message: string } | null }): T {
  if (error) throw new Error(error.message)
  return data as T
}

function shelterOf(row: Row): Shelter {
  const { id, name, address, contact, lat, lng, totalCapacity, currentOccupancy, operationalStatus, verificationStatus, ...features } = camel(row)
  return { id, name, address, contact, lat, lng, totalCapacity, currentOccupancy, operationalStatus, verificationStatus, features } as unknown as Shelter
}

export type Remote = Pick<State, 'families' | 'shelters' | 'volunteers' | 'assignments' | 'events' | 'unmet'>

export async function fetchAll(): Promise<Remote> {
  const db = supabase!
  const [families, shelters, volunteers, assignments, events, unmet] = await Promise.all([
    db.from('family_units').select('*, needs:functional_needs(*)').order('id'),
    db.from('shelters').select('*').order('id'),
    db.from('volunteers').select('*').order('id'),
    db.from('evacuation_assignments').select('*').order('created_at'),
    db.from('disaster_events').select('*').order('time', { ascending: false }),
    db.from('unmet_needs').select('*').order('reported_at'),
  ])
  return {
    families: must(families).map((r) => ({ ...camel(r), needs: camel(r.needs as Row) }) as unknown as Family),
    shelters: must(shelters).map(shelterOf),
    volunteers: must(volunteers).map((r) => camel(r) as unknown as Volunteer),
    assignments: must(assignments).map((r) => camel(r) as unknown as Assignment),
    events: must(events).map((r) => camel(r) as unknown as DisasterEvent),
    unmet: must(unmet).map((r) => camel(r) as unknown as UnmetNeed),
  }
}

const PROFILE_KEY = 'evacfit-profile'

/** Signed-in profile. Offline (OFFL-1) the last profile of the same account is reused so field staff are not locked out. */
export async function fetchProfile(): Promise<Profile | null> {
  const { data } = await supabase!.auth.getSession() // local: works without signal
  const uid = data.session?.user.id
  if (!uid) {
    localStorage.removeItem(PROFILE_KEY)
    return null
  }
  try {
    const p = await loadProfile(uid)
    localStorage.setItem(PROFILE_KEY, JSON.stringify({ uid, p }))
    return p
  } catch (e) {
    const cached = JSON.parse(localStorage.getItem(PROFILE_KEY) ?? 'null') as { uid: string; p: Profile } | null
    if (cached?.uid === uid) return cached.p
    throw e
  }
}

async function loadProfile(uid: string): Promise<Profile | null> {
  const row = must(await supabase!.from('profiles')
    .select('role, display_name, shelter_id, volunteer_id, area:operation_areas(id, name, center_lat, center_lng, country:countries(code, emergency_number, service_languages))')
    .eq('id', uid).maybeSingle()) as unknown as ProfileRow | null
  if (!row) return null
  const a = row.area
  return {
    role: row.role as Role,
    displayName: row.display_name,
    shelterId: row.shelter_id ?? undefined,
    volunteerId: row.volunteer_id ?? undefined,
    area: a ? { id: a.id, name: a.name, center: { lat: a.center_lat, lng: a.center_lng } } : undefined,
    country: a?.country ? { code: a.country.code, emergencyNumber: a.country.emergency_number, serviceLanguages: a.country.service_languages } : undefined,
  }
}

interface ProfileRow {
  role: string
  display_name: string
  shelter_id: string | null
  volunteer_id: string | null
  area: { id: string; name: string; center_lat: number; center_lng: number; country: { code: string; emergency_number: string; service_languages: string[] } | null } | null
}

/** Which served operation area a point falls in (null = outside every area). Supabase mode only. */
export async function areaAt(p: LatLng): Promise<{ id: string; name: string } | null> {
  const { data, error } = await supabase!.rpc('area_at', { p_lat: p.lat, p_lng: p.lng })
  if (error) throw new Error(error.message)
  return data
}

export type RouteProfile = 'wheelchair' | 'driving-car'
export interface Route { km: number; minutes: number; coords: [number, number][]; steps: { text: string; m: number }[] }

/** NAV-1/NAV-4: road route via the `route` Edge Function (ORS key stays server-side). null = no route for this profile. */
export async function fetchRoute(from: LatLng, to: LatLng, profile: RouteProfile, lang: 'id' | 'en'): Promise<Route | null> {
  const { data, error } = await supabase!.functions.invoke('route', { body: { from, to, profile, lang } })
  if (error) throw new Error(error.message)
  return (data as { route?: Route }).route ?? null
}

/** Areas a staff account can switch to (those with shelters). Supabase mode only. */
export async function workAreas(): Promise<{ id: string; name: string }[]> {
  const { data, error } = await supabase!.rpc('work_areas')
  if (error) throw new Error(error.message)
  return data ?? []
}

/** Action types the server owns. Everything else (language, prefs, alerts, persona) stays in the browser. */
export const remoteActions = new Set<Action['type']>([
  'activate_event', 'close_event', 'run_matching', 'confirm', 'reject', 'ready', 'dispatch', 'depart', 'check_in',
  'save_family', 'save_shelter', 'create_shelter', 'switch_work', 'refer', 'report_location', 'set_shelter_status', 'verify_shelter', 'resolve_unmet',
])

function call(a: Action): [string, Row] {
  switch (a.type) {
    case 'activate_event': return ['activate_event', { e: a.event }]
    case 'close_event': return ['close_event', { p_id: a.id }]
    case 'run_matching': return ['run_matching', {}]
    case 'confirm': return ['confirm_assignment', { p_id: a.id }]
    case 'reject': return ['reject_assignment', { p_id: a.id, p_code: a.code, p_note: a.note }]
    case 'ready': return ['mark_ready', { p_id: a.id }]
    case 'dispatch': return ['dispatch_assignment', { p_id: a.id, p_volunteer: a.volunteerId }]
    case 'depart': return ['depart', { p_id: a.id }]
    case 'check_in': return ['check_in', { p_id: a.id, p_unmet: a.unmet ?? null }]
    case 'save_family': return ['save_family', { f: a.family }]
    case 'save_shelter': return ['save_shelter', { s: a.shelter }]
    case 'create_shelter': return ['create_shelter', { s: a.shelter }]
    case 'refer': return ['refer_family', { p_id: a.id }]
    case 'switch_work': return ['switch_work', { p_shelter: a.shelterId ?? null, p_volunteer: a.volunteerId ?? null, p_area: a.areaId ?? null }]
    case 'report_location': return ['report_location', { p_family: a.familyId, p_lat: a.at?.lat ?? null, p_lng: a.at?.lng ?? null }]
    case 'set_shelter_status': return ['set_shelter_status', { p_id: a.id, p_status: a.status }]
    case 'verify_shelter': return ['verify_shelter', { p_id: a.id, p_verified: a.verified }]
    case 'resolve_unmet': return ['resolve_unmet', { p_id: a.id, p_status: a.status }]
    default: throw new Error(`not a remote action: ${a.type}`)
  }
}

const errorCodes = ['no_event', 'not_found', 'bad_transition', 'not_confirmed', 'vehicle_mismatch', 'forbidden', 'outside_area', 'shelter_unverified'] as const
type ErrorCode = Extract<AlertMsg, { k: 'error' }>['code']

/**
 * F3: ask the OR-Tools service for a global placement. Any failure (no URL, timeout, cold start, solver down) returns
 * null and run_matching falls back to the greedy matcher, so the button always works.
 */
async function solverPreference(): Promise<Record<string, string> | null> {
  const url = import.meta.env.VITE_SOLVER_URL
  if (!url) return null
  const { data: problem, error } = await supabase!.rpc('matching_problem')
  if (error) return null // run_matching reports the real error (e.g. no_event)
  try {
    const res = await fetch(`${url}/solve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(problem),
      signal: AbortSignal.timeout(10_000),
    })
    const r = (await res.json()) as { status: string; assignment: Record<string, string> }
    return res.ok && (r.status === 'OPTIMAL' || r.status === 'FEASIBLE') ? r.assignment : null
  } catch {
    return null
  }
}

/** Runs one action on the server; returns the alerts it produced. Throws with a client error code. */
export async function send(a: Action): Promise<Pick<Alert, 'tone' | 'msg'>[]> {
  if (a.type === 'activate_event' && a.match) {
    // One step for the coordinator: activate, then place everyone (solver first, greedy fallback).
    const activated = await send({ ...a, match: false })
    return [...activated, ...(await send({ type: 'run_matching' }))]
  }
  const [fn, args] = a.type === 'run_matching' ? ['run_matching', { p_prefer: await solverPreference() }] as const : call(a)
  const { data, error } = await supabase!.rpc(fn, args)
  if (error) {
    const code = errorCodes.find((c) => error.message === c) ?? 'server'
    throw new RemoteError(code)
  }
  return (data ?? []) as Pick<Alert, 'tone' | 'msg'>[]
}

/** Replays one queued field action exactly once (server dedupes on the request id, see run_once). */
export async function sendOnce(item: OutboxItem): Promise<Pick<Alert, 'tone' | 'msg'>[]> {
  const [fn, args] = call(item.action as Action)
  const { data, error } = await supabase!.rpc('run_once', { p_request: item.id, p_fn: fn, p_args: args })
  if (error) {
    if (!navigator.onLine || /fetch|network|load failed/i.test(error.message)) throw new OfflineError()
    throw new RemoteError(errorCodes.find((c) => error.message === c) ?? 'server')
  }
  return (data ?? []) as Pick<Alert, 'tone' | 'msg'>[]
}

/** No signal: keep the item queued and try again later. */
export class OfflineError extends Error {}

export class RemoteError extends Error {
  constructor(public code: ErrorCode) {
    super(code)
  }
}
