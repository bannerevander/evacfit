// shortcut: client-side greedy stand-in for the Google OR-Tools solver (MTCH-1). It keeps the same
// hard constraints (MTCH-2) and preferences (MTCH-3/4) so the UI can be designed now; replace with the
// backend /matching-runs call when the solver service exists.
import type { Assignment, AssignmentStatus, DisasterEvent, Family, FacilityType, MatchReason, NeedKey, Severity, Shelter, UnmetDetail } from '../types'
import { distanceKm, pickupOf, vulnerabilityScore } from './geo'

export const ACTIVE_STATUSES: AssignmentStatus[] = ['recommended', 'confirmed', 'in_transit']

export interface ShelterLoad {
  occupied: number
  reserved: number
  remaining: number
  powerRemaining: number
}

export function shelterLoad(s: Shelter, assignments: Assignment[], familiesById: Map<string, Family>): ShelterLoad {
  let arrived = 0
  let reserved = 0
  let power = 0
  for (const a of assignments) {
    if (a.shelterId !== s.id) continue
    const f = familiesById.get(a.familyId)
    if (!f) continue
    const holds = ACTIVE_STATUSES.includes(a.status)
    if (a.status === 'arrived') arrived += f.memberCount
    if (holds) reserved += f.memberCount
    if ((holds || a.status === 'arrived') && f.needs.medicalPowerRequired) power += f.needs.minPowerWattage
  }
  const occupied = s.currentOccupancy + arrived
  return {
    occupied,
    reserved,
    remaining: Math.max(0, s.totalCapacity - occupied - reserved),
    powerRemaining: Math.max(0, s.features.backupGeneratorCapacityWatt - power),
  }
}

export const facilityTypes: FacilityType[] = ['medical_power', 'caregiver_room', 'no_stairs', 'accessible_toilet', 'general_capacity']

type NeedCheck = { need: NeedKey; type: FacilityType; ok: (f: Family, s: Shelter, load: ShelterLoad) => boolean }

/** Order matters: the first need no shelter can satisfy is reported as the deficit. */
const needChecks: NeedCheck[] = [
  { need: 'medicalPowerRequired', type: 'medical_power', ok: (f, s, l) => s.features.hasMedicalPower && l.powerRemaining >= f.needs.minPowerWattage },
  { need: 'caregiverSpaceNeeded', type: 'caregiver_room', ok: (_f, s) => s.features.hasCaregiverRooms },
  { need: 'noStairsRequired', type: 'no_stairs', ok: (_f, s) => s.features.hasRamp && s.features.rampSlopeCompliant && s.features.doorWidthAccessible },
  { need: 'accessibleToiletNeeded', type: 'accessible_toilet', ok: (_f, s) => s.features.hasAccessibleToilet },
]

const applies = (f: Family, c: NeedCheck) => f.needs[c.need]

function isAccessibleShelter(s: Shelter): boolean {
  return (s.features.hasRamp && s.features.hasAccessibleToilet) || s.features.hasMedicalPower || s.features.hasCaregiverRooms
}

/** Usable at all for this event: open, verified (SHLT-5) and outside the hazard radius. */
export function shelterUsable(s: Shelter, event: DisasterEvent): boolean {
  return s.operationalStatus === 'open' && s.verificationStatus === 'verified' && distanceKm(s, event) > event.radiusKm
}

// shortcut: demo data has no operation areas, so a distance cap stands in for the server's area + neighbours scope
// (keeps Medan families out of Karo shelters); drop it if the demo store ever gets areas.
const REACH_KM = 30

export interface Placement {
  familyId: string
  shelterId: string
  distanceKm: number
  reason: MatchReason
}

export interface UnmetDraft {
  familyId: string
  /** Set for a temporary placement with gaps (safety first); unset = backlog, no place yet. */
  shelterId?: string
  missingFacilityType: FacilityType
  detail: UnmetDetail
  severity: Severity
}

function severityOf(f: Family): Severity {
  const s = vulnerabilityScore(f.needs)
  return s >= 6 ? 'critical' : s >= 3 ? 'high' : s > 0 ? 'medium' : 'low'
}

function reasonFor(f: Family, s: Shelter, d: number, l: ShelterLoad, gaps: NeedKey[], inZone: boolean): MatchReason {
  const all = needChecks.filter((c) => applies(f, c)).map((c) => c.need)
  const needs = all.filter((n) => !gaps.includes(n))
  const lang = f.needs.preferredLanguage !== 'Indonesia' && s.features.supportedLanguages.includes(f.needs.preferredLanguage) ? f.needs.preferredLanguage : undefined
  return {
    needs,
    gaps: gaps.length ? gaps : undefined,
    inZone: inZone || undefined,
    powerAvailable: f.needs.medicalPowerRequired && !gaps.includes('medicalPowerRequired') ? l.powerRemaining : undefined,
    language: lang,
    general: all.length ? undefined : isAccessibleShelter(s) ? 'no_better' : 'keep_accessible',
    people: f.memberCount,
    km: d,
  }
}

/** Backlog only happens when no safe shelter has seats: name a need nobody has at all, else plain capacity. */
function explainUnmet(f: Family, pool: Shelter[], loads: Map<string, ShelterLoad>): UnmetDraft {
  const checks = needChecks.filter((c) => applies(f, c))
  const base = { people: f.memberCount, watt: f.needs.medicalPowerRequired ? f.needs.minPowerWattage : 0 }
  const severity = severityOf(f)
  for (const c of checks) {
    const anyHas = pool.some((s) => c.ok(f, s, { ...loads.get(s.id)!, powerRemaining: s.features.backupGeneratorCapacityWatt }))
    if (!anyHas) return { familyId: f.id, missingFacilityType: c.type, severity, detail: { kind: 'none_has', needs: [c.need], ...base } }
  }
  return { familyId: f.id, missingFacilityType: 'general_capacity', severity, detail: { kind: 'full', needs: [], ...base } }
}

export interface MatchInput {
  families: Family[]
  shelters: Shelter[]
  assignments: Assignment[]
  event: DisasterEvent
  /** Only these families are matched (EMER-5 all, MTCH-7 / UNMT-4 targeted). */
  familyIds: string[]
  /** Shelters a family must not be sent to again (previous rejections). */
  excluded?: Record<string, string[]>
  /** Referral: only a shelter that meets every need; no temporary placement, no backlog record. */
  strict?: boolean
}

/**
 * Safety first, needs second (mirrors private.match): a shelter meeting every need if one has seats; otherwise the
 * nearest safe shelter with seats, placed now with its gaps recorded; backlog only when no safe shelter has seats.
 */
export function matchFamilies({ families, shelters, assignments, event, familyIds, excluded = {}, strict = false }: MatchInput) {
  const byId = new Map(families.map((f) => [f.id, f]))
  // Outside the hazard zone first; an open, verified shelter inside it is the last resort (city-wide hazards).
  const pool = shelters.filter((s) => s.operationalStatus === 'open' && s.verificationStatus === 'verified' && distanceKm(s, event) <= event.radiusKm + REACH_KM)
  const inZone = (s: Shelter) => !shelterUsable(s, event)
  const loads = new Map(pool.map((s) => [s.id, shelterLoad(s, assignments, byId)]))
  const placements: Placement[] = []
  const unmet: UnmetDraft[] = []

  const queue = familyIds
    .map((id) => byId.get(id))
    .filter((f): f is Family => !!f)
    .sort((a, b) => vulnerabilityScore(b.needs) - vulnerabilityScore(a.needs) || a.id.localeCompare(b.id))

  for (const f of queue) {
    const special = needChecks.some((c) => applies(f, c))
    let best: { s: Shelter; d: number; cost: number; gaps: NeedKey[] } | undefined
    for (const zone of [false, true]) {
    let nearest: typeof best
    for (const s of pool.filter((x) => inZone(x) === zone)) {
      if (excluded[f.id]?.includes(s.id)) continue
      const l = loads.get(s.id)!
      if (l.remaining < f.memberCount) continue
      const gaps = needChecks.filter((c) => applies(f, c) && !c.ok(f, s, l)).map((c) => c.need)
      const d = distanceKm(pickupOf(f), s)
      if (gaps.length) {
        if (!nearest || d < nearest.d || (d === nearest.d && gaps.length < nearest.gaps.length)) nearest = { s, d, cost: d, gaps }
        continue
      }
      const cost =
        d +
        (!special && isAccessibleShelter(s) ? 5 : 0) + // MTCH-3: keep accessible space free
        (s.features.supportedLanguages.includes(f.needs.preferredLanguage) ? 0 : 2) // MTCH-4 language preference
      if (!best || cost < best.cost) best = { s, d, cost, gaps }
    }
    if (!best && !strict) best = nearest
    if (best) break
    }
    if (!best) {
      if (!strict) unmet.push(explainUnmet(f, pool, loads))
      continue
    }
    const l = loads.get(best.s.id)!
    placements.push({ familyId: f.id, shelterId: best.s.id, distanceKm: best.d, reason: reasonFor(f, best.s, best.d, l, best.gaps, inZone(best.s)) })
    if (best.gaps.length) {
      const first = needChecks.find((c) => c.need === best.gaps[0])!
      const watt = best.gaps.includes('medicalPowerRequired') ? f.needs.minPowerWattage : 0
      unmet.push({ familyId: f.id, shelterId: best.s.id, missingFacilityType: first.type, severity: severityOf(f), detail: { kind: 'gaps', needs: best.gaps, people: f.memberCount, watt } })
    }
    l.remaining -= f.memberCount
    if (f.needs.medicalPowerRequired) l.powerRemaining = Math.max(0, l.powerRemaining - f.needs.minPowerWattage)
  }
  return { placements, unmet }
}

/** Families inside the hazard radius that still need a place. */
export function familiesToMatch(families: Family[], event: DisasterEvent): string[] {
  return families
    .filter((f) => (f.status === 'idle' || f.status === 'waiting_match') && distanceKm(pickupOf(f), event) <= event.radiusKm)
    .map((f) => f.id)
}
