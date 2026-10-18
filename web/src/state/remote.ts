// Supabase backend (VITE_DATA_MODE=supabase). Reads go through RLS; every domain write is one Postgres RPC
// (supabase/migrations/*_rpc.sql), which also owns matching, capacity locks and soft-lock expiry.
import { createClient } from '@supabase/supabase-js'
import type { AlertMsg, Assignment, DisasterEvent, Family, Role, Shelter, UnmetNeed, Volunteer } from '../types'
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

export async function fetchProfile(): Promise<Profile | null> {
  const { data } = await supabase!.auth.getUser()
  if (!data.user) return null
  const row = must(await supabase!.from('profiles').select('*').eq('id', data.user.id).maybeSingle())
  return row ? (camel(row) as unknown as Profile) : null
}

/** Action types the server owns. Everything else (language, prefs, alerts, persona) stays in the browser. */
export const remoteActions = new Set<Action['type']>([
  'activate_event', 'close_event', 'run_matching', 'confirm', 'reject', 'ready', 'dispatch', 'depart', 'check_in',
  'save_family', 'save_shelter', 'set_shelter_status', 'verify_shelter', 'resolve_unmet',
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
    case 'set_shelter_status': return ['set_shelter_status', { p_id: a.id, p_status: a.status }]
    case 'verify_shelter': return ['verify_shelter', { p_id: a.id, p_verified: a.verified }]
    case 'resolve_unmet': return ['resolve_unmet', { p_id: a.id, p_status: a.status }]
    default: throw new Error(`not a remote action: ${a.type}`)
  }
}

const errorCodes = ['no_event', 'not_found', 'bad_transition', 'not_confirmed', 'vehicle_mismatch', 'forbidden'] as const
type ErrorCode = Extract<AlertMsg, { k: 'error' }>['code']

/** Runs one action on the server; returns the alerts it produced. Throws with a client error code. */
export async function send(a: Action): Promise<Pick<Alert, 'tone' | 'msg'>[]> {
  const [fn, args] = call(a)
  const { data, error } = await supabase!.rpc(fn, args)
  if (error) {
    const code = errorCodes.find((c) => error.message === c) ?? 'server'
    throw new RemoteError(code)
  }
  return (data ?? []) as Pick<Alert, 'tone' | 'msg'>[]
}

export class RemoteError extends Error {
  constructor(public code: ErrorCode) {
    super(code)
  }
}
