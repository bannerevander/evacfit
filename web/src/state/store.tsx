// Demo mode: this reducer is the backend (persisted to localStorage). Supabase mode: domain actions run as Postgres RPCs
// (state/remote.ts) and the reducer only holds the latest server snapshot plus browser-only state.
import { createContext, useCallback, useContext, useEffect, useReducer, useRef, useState, type Dispatch, type ReactNode } from 'react'
import * as mock from '../data/mock'
import { setFormatLang } from '../i18n/format'
import { familiesToMatch, matchFamilies } from '../lib/matching'
import type {
  AlertMsg, Assignment, AssignmentStatus, DisasterEvent, Family, FacilityType, Lang, OutboxItem, RejectionCode, Severity, Shelter, ShelterOperationalStatus, UnmetNeed,
} from '../types'
import { canTransition, expiredLocks, SOFT_LOCK_MINUTES, vehicleFits } from './machine'
import { dataMode, fetchAll, fetchProfile, RemoteError, remoteActions, send, supabase, type Profile, type Remote } from './remote'

export interface Alert {
  id: string
  tone: 'info' | 'warning' | 'critical'
  msg: AlertMsg
  at: string
}

export interface State {
  families: Family[]
  shelters: Shelter[]
  assignments: Assignment[]
  events: DisasterEvent[]
  unmet: UnmetNeed[]
  alerts: Alert[]
  offline: boolean
  outbox: OutboxItem[]
  prefs: { highContrast: boolean; simpleText: boolean }
  lang: Lang
  /** Demo-only: which family / shelter / volunteer the current viewer acts as (replaced by login). */
  persona: { family: string; shelter: string; volunteer: string }
}

export type Action =
  | { type: 'activate_event'; event: DisasterEvent }
  | { type: 'close_event'; id: string }
  | { type: 'run_matching' }
  | { type: 'confirm'; id: string }
  | { type: 'reject'; id: string; code: RejectionCode; note: string }
  | { type: 'ready'; id: string }
  | { type: 'dispatch'; id: string; volunteerId: string }
  | { type: 'depart'; id: string }
  | { type: 'check_in'; id: string; unmet?: { type: FacilityType; description: string; severity: Severity } }
  | { type: 'save_family'; family: Family }
  | { type: 'save_shelter'; shelter: Shelter }
  | { type: 'set_shelter_status'; id: string; status: ShelterOperationalStatus }
  | { type: 'expire_locks' }
  | { type: 'verify_shelter'; id: string; verified: boolean }
  | { type: 'resolve_unmet'; id: string; status: UnmetNeed['resolutionStatus'] }
  | { type: 'set_offline'; offline: boolean }
  | { type: 'set_pref'; key: keyof State['prefs']; value: boolean }
  | { type: 'set_persona'; key: keyof State['persona']; value: string }
  | { type: 'set_lang'; lang: Lang }
  | { type: 'dismiss_alert'; id: string }
  | { type: 'reset' }
  | { type: 'hydrate'; data: Remote; alerts: Pick<Alert, 'tone' | 'msg'>[] }
  | { type: 'remote_error'; code: RemoteError['code'] }

// v2: generated texts became structured data (i18n); older saved demos are ignored.
const STORAGE_KEY = dataMode === 'supabase' ? 'evacfit-supabase-v1' : 'evacfit-demo-v2'

/** First visit: Indonesian browsers get Indonesian, everyone else English. */
function detectLang(): Lang {
  return typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('id') ? 'id' : 'en'
}

export function initialState(): State {
  return {
    families: mock.families,
    shelters: mock.shelters,
    assignments: [],
    events: mock.disasterEvents,
    unmet: [],
    alerts: [],
    offline: false,
    outbox: [],
    prefs: { highContrast: false, simpleText: false },
    lang: detectLang(),
    persona: { family: 'fam-01', shelter: 'sh-01', volunteer: 'vol-01' },
  }
}

function load(): State {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { ...initialState(), ...(JSON.parse(raw) as Partial<State>) }
  } catch {
    // Private mode / blocked storage: fall back to fresh demo data.
  }
  return initialState()
}

const now = () => new Date().toISOString()
const uid = () => crypto.randomUUID()

export function activeEvent(s: State): DisasterEvent | undefined {
  return s.events.find((e) => e.status === 'active')
}

/** The assignment that currently describes the family (latest one). */
export function currentAssignment(s: State, familyId: string): Assignment | undefined {
  return s.assignments.filter((a) => a.familyId === familyId).at(-1)
}

function alert(s: State, tone: Alert['tone'], msg: AlertMsg): State {
  return { ...s, alerts: [{ id: uid(), tone, msg, at: now() }, ...s.alerts].slice(0, 20) }
}

class StoreError extends Error {
  constructor(public code: Extract<AlertMsg, { k: 'error' }>['code']) {
    super(code)
  }
}

function setFamilyStatus(s: State, ids: string[], status: Family['status']): State {
  return { ...s, families: s.families.map((f) => (ids.includes(f.id) ? { ...f, status } : f)) }
}

function move(s: State, id: string, to: AssignmentStatus, patch: Partial<Assignment> = {}): State {
  const a = s.assignments.find((x) => x.id === id)
  if (!a) throw new StoreError('not_found')
  if (!canTransition(a.status, to)) throw new StoreError('bad_transition')
  return { ...s, assignments: s.assignments.map((x) => (x.id === id ? { ...x, ...patch, status: to } : x)) }
}

/** Runs the matcher for the given families and writes recommendations / unmet backlog (MTCH-5..7, RULE 6). */
function match(s: State, familyIds: string[], reallocatedFrom: Record<string, string> = {}): State {
  const event = activeEvent(s)
  if (!event || familyIds.length === 0) return s
  const excluded: Record<string, string[]> = {}
  for (const a of s.assignments) {
    if (a.status === 'rejected' || a.status === 'reallocated') (excluded[a.familyId] ??= []).push(a.shelterId)
  }
  const { placements, unmet } = matchFamilies({
    families: s.families, shelters: s.shelters, assignments: s.assignments, event, familyIds, excluded,
  })
  const t = now()
  const lock = new Date(Date.now() + SOFT_LOCK_MINUTES * 60_000).toISOString()
  const created: Assignment[] = placements.map((p) => ({
    id: uid(), familyId: p.familyId, shelterId: p.shelterId, status: 'recommended', reason: p.reason, distanceKm: p.distanceKm,
    createdAt: t, softLockExpiresAt: lock, reallocatedFromId: reallocatedFrom[p.familyId],
  }))
  const placed = new Set(placements.map((p) => p.familyId))
  const unmetIds = new Set(unmet.map((u) => u.familyId))
  let next: State = {
    ...s,
    assignments: [...s.assignments, ...created],
    unmet: [
      ...s.unmet.map((u) => (u.resolutionStatus !== 'resolved' && !u.shelterId && (placed.has(u.familyId) || unmetIds.has(u.familyId))
        ? { ...u, resolutionStatus: 'resolved' as const } : u)),
      ...unmet.map((u) => ({ ...u, id: uid(), resolutionStatus: 'open' as const, reportedAt: t })),
    ],
  }
  next = setFamilyStatus(next, [...placed], 'recommended')
  next = setFamilyStatus(next, [...unmetIds], 'waiting_match')
  return next
}

function reduce(s: State, a: Action): State {
  switch (a.type) {
    case 'activate_event': {
      const exists = s.events.some((e) => e.id === a.event.id)
      const events = (exists ? s.events.map((e) => (e.id === a.event.id ? a.event : e)) : [a.event, ...s.events]).map((e) =>
        e.id === a.event.id ? { ...e, status: 'active' as const } : e.status === 'active' ? { ...e, status: 'closed' as const } : e,
      )
      const next = { ...s, events }
      const inZone = familiesToMatch(next.families, { ...a.event, status: 'active' })
      return alert(setFamilyStatus(next, inZone, 'waiting_match'), 'critical', { k: 'activated', title: a.event.title, n: inZone.length })
    }
    case 'close_event':
      return alert({ ...s, events: s.events.map((e) => (e.id === a.id ? { ...e, status: 'closed' } : e)) }, 'info', { k: 'closed' })
    case 'run_matching': {
      const event = activeEvent(s)
      if (!event) throw new StoreError('no_event')
      const ids = familiesToMatch(s.families, event)
      const next = match(s, ids)
      const made = next.assignments.length - s.assignments.length
      return alert(next, 'info', { k: 'matched', made, backlog: ids.length - made })
    }
    case 'confirm': {
      const next = move(s, a.id, 'confirmed', { confirmedAt: now() })
      const as = next.assignments.find((x) => x.id === a.id)!
      return setFamilyStatus(next, [as.familyId], 'confirmed')
    }
    case 'reject': {
      const as = s.assignments.find((x) => x.id === a.id)!
      let next = move(s, a.id, 'rejected', { rejectionCode: a.code, rejectionReason: a.note })
      next = setFamilyStatus(next, [as.familyId], 'waiting_match')
      next = match(next, [as.familyId], { [as.familyId]: a.id })
      return reallocationAlert(next, as.familyId)
    }
    case 'set_shelter_status': {
      let next: State = { ...s, shelters: s.shelters.map((x) => (x.id === a.id ? { ...x, operationalStatus: a.status } : x)) }
      if (a.status !== 'closed_emergency' && a.status !== 'inactive') return next
      return reallocate(next, next.assignments.filter((x) => x.shelterId === a.id && ['recommended', 'confirmed', 'in_transit'].includes(x.status)))
    }
    case 'expire_locks': {
      const expired = expiredLocks(s.assignments, now())
      return expired.length ? reallocate(s, expired) : s
    }
    case 'ready':
      return { ...s, assignments: s.assignments.map((x) => (x.id === a.id ? { ...x, readyForPickupAt: now() } : x)) }
    case 'dispatch': {
      const as = s.assignments.find((x) => x.id === a.id)!
      const fam = s.families.find((f) => f.id === as.familyId)!
      const vol = mock.volunteers.find((v) => v.id === a.volunteerId)!
      if (as.status !== 'confirmed') throw new StoreError('not_confirmed') // RULE 5
      if (!vehicleFits(fam, vol.vehicleType)) throw new StoreError('vehicle_mismatch') // NAV-3
      return { ...s, assignments: s.assignments.map((x) => (x.id === a.id ? { ...x, volunteerId: vol.id, vehicleType: vol.vehicleType } : x)) }
    }
    case 'depart': {
      const next = move(s, a.id, 'in_transit', { departedAt: now() })
      return setFamilyStatus(next, [next.assignments.find((x) => x.id === a.id)!.familyId], 'in_transit')
    }
    case 'check_in': {
      let next = move(s, a.id, 'arrived', { arrivedAt: now() })
      const as = next.assignments.find((x) => x.id === a.id)!
      next = setFamilyStatus(next, [as.familyId], 'arrived')
      if (!a.unmet) return next
      const log: UnmetNeed = {
        id: uid(), familyId: as.familyId, shelterId: as.shelterId, missingFacilityType: a.unmet.type, description: a.unmet.description,
        severity: a.unmet.severity, resolutionStatus: 'open', reportedAt: now(),
      }
      const fam = next.families.find((f) => f.id === as.familyId)!
      return alert({ ...next, unmet: [...next.unmet, log] }, 'warning', { k: 'checkin_unmet', family: fam.familyName, facility: a.unmet.type })
    }
    case 'save_family': {
      const exists = s.families.some((f) => f.id === a.family.id)
      return { ...s, families: exists ? s.families.map((f) => (f.id === a.family.id ? a.family : f)) : [...s.families, a.family] }
    }
    case 'save_shelter':
      return { ...s, shelters: s.shelters.map((x) => (x.id === a.shelter.id ? a.shelter : x)) }
    case 'verify_shelter':
      return { ...s, shelters: s.shelters.map((x) => (x.id === a.id ? { ...x, verificationStatus: a.verified ? 'verified' : 'unverified' } : x)) }
    case 'resolve_unmet':
      return { ...s, unmet: s.unmet.map((u) => (u.id === a.id ? { ...u, resolutionStatus: a.status } : u)) }
    case 'set_offline':
      if (!a.offline && s.outbox.length) return alert({ ...s, offline: false, outbox: [] }, 'info', { k: 'synced', n: s.outbox.length })
      return { ...s, offline: a.offline }
    case 'set_pref':
      return { ...s, prefs: { ...s.prefs, [a.key]: a.value } }
    case 'set_persona':
      return { ...s, persona: { ...s.persona, [a.key]: a.value } }
    case 'set_lang':
      return { ...s, lang: a.lang }
    case 'dismiss_alert':
      return { ...s, alerts: s.alerts.filter((x) => x.id !== a.id) }
    case 'reset':
      return { ...initialState(), lang: s.lang, prefs: s.prefs }
    case 'hydrate':
      return a.alerts.reduce((next, x) => alert(next, x.tone, x.msg), { ...s, ...a.data })
    case 'remote_error':
      return alert(s, 'critical', { k: 'error', code: a.code })
  }
}

/** Releases the given assignments and re-matches their families elsewhere (SHLT-6, CONF-2, MTCH-7). */
function reallocate(s: State, affected: Assignment[]): State {
  let next = s
  for (const x of affected) next = move(next, x.id, 'reallocated')
  const famIds = affected.map((x) => x.familyId)
  next = setFamilyStatus(next, famIds, 'waiting_match')
  next = match(next, famIds, Object.fromEntries(affected.map((x) => [x.familyId, x.id])))
  for (const f of famIds) next = reallocationAlert(next, f)
  return next
}

function reallocationAlert(s: State, familyId: string): State {
  const fam = s.families.find((f) => f.id === familyId)!
  const latest = currentAssignment(s, familyId)
  if (latest?.status === 'recommended') {
    const sh = s.shelters.find((x) => x.id === latest.shelterId)!
    return alert(s, 'warning', { k: 'reallocated', family: fam.familyName, shelter: sh.name })
  }
  return alert(s, 'critical', { k: 'no_alternative', family: fam.familyName })
}

/** Field actions taken offline are queued in the outbox (OFFL-3) and flushed when back online (OFFL-4). */
const queued = new Set<Action['type']>(['save_family', 'depart', 'check_in', 'ready'])

function reducer(s: State, a: Action): State {
  try {
    const next = reduce(s, a)
    if (s.offline && queued.has(a.type)) return { ...next, outbox: [...next.outbox, { id: uid(), kind: a.type as OutboxItem['kind'], at: now(), action: a }] }
    return next
  } catch (e) {
    if (e instanceof StoreError) return alert(s, 'critical', { k: 'error', code: e.code })
    throw e
  }
}

/** Signed-in account in supabase mode (undefined while loading, null when signed out). Demo mode has no accounts. */
type Ctx = { state: State; dispatch: Dispatch<Action>; profile: Profile | null | undefined }
const Ctx = createContext<Ctx | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, local] = useReducer(reducer, undefined, load)
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined)
  const stateRef = useRef(state)
  stateRef.current = state
  setFormatLang(state.lang)

  const refresh = useCallback(async (alerts: Pick<Alert, 'tone' | 'msg'>[] = []) => {
    const { data } = await supabase!.auth.getSession()
    if (data.session) local({ type: 'hydrate', data: await fetchAll(), alerts })
  }, [])

  /** Server first, then a fresh snapshot; failures surface as the same error alerts the demo shows. */
  const run = useCallback(async (actions: Action[]) => {
    const alerts: Pick<Alert, 'tone' | 'msg'>[] = []
    for (const a of actions) {
      try {
        alerts.push(...(await send(a)))
      } catch (e) {
        local({ type: 'remote_error', code: e instanceof RemoteError ? e.code : 'server' })
      }
    }
    await refresh(alerts).catch(() => local({ type: 'remote_error', code: 'server' }))
  }, [refresh])

  const dispatch = useCallback((a: Action) => {
    if (dataMode === 'demo') return local(a)
    const s = stateRef.current
    if (a.type === 'set_offline' && !a.offline && s.outbox.length) {
      // OFFL-4: replay what was queued, then clear the outbox (reducer) and show the synced notice.
      const queuedActions = s.outbox.map((o) => o.action as Action).filter(Boolean)
      void run(queuedActions).then(() => local(a))
      return
    }
    if (!remoteActions.has(a.type) || (s.offline && queued.has(a.type))) return local(a) // offline: optimistic + outbox
    void run([a])
  }, [run])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      // Storage full or blocked: demo keeps working in memory.
    }
  }, [state])

  useEffect(() => {
    if (dataMode === 'supabase') {
      // Soft-locks expire in pg_cron; the browser only re-reads the server so other roles' changes show up.
      const t = window.setInterval(() => void refresh().catch(() => {}), 15_000)
      const { data } = supabase!.auth.onAuthStateChange(() => {
        // Defer: supabase-js warns against awaiting its own calls inside this callback.
        setTimeout(() => {
          void fetchProfile().then((p) => {
            setProfile(p)
            if (p?.shelterId) local({ type: 'set_persona', key: 'shelter', value: p.shelterId })
            if (p?.volunteerId) local({ type: 'set_persona', key: 'volunteer', value: p.volunteerId })
            return refresh()
          }).catch(() => setProfile(null))
        })
      })
      return () => {
        window.clearInterval(t)
        data.subscription.unsubscribe()
      }
    }
    // Also runs on load so locks that lapsed while the demo was closed are released.
    local({ type: 'expire_locks' })
    const t = window.setInterval(() => local({ type: 'expire_locks' }), 30_000)
    return () => window.clearInterval(t)
  }, [refresh])

  useEffect(() => {
    const on = () => dispatch({ type: 'set_offline', offline: false })
    const off = () => dispatch({ type: 'set_offline', offline: true })
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  useEffect(() => {
    const root = document.documentElement
    root.dataset.contrast = state.prefs.highContrast ? 'high' : 'normal'
  }, [state.prefs])

  useEffect(() => {
    document.documentElement.lang = state.lang
  }, [state.lang])

  return <Ctx.Provider value={{ state, dispatch, profile }}>{children}</Ctx.Provider>
}

export function useStore() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useStore must be used inside StoreProvider')
  return ctx
}
