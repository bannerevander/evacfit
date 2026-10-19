// Assert-based self-check: `npm run check`. Verifies safety-first placement, needs met unless recorded as gaps,
// no overbooking, referrals (strict) and the state machine.
import assert from 'node:assert/strict'
import { families, floodScenario, shelters } from '../data/mock'
import { canTransition, expiredLocks, vehicleFits } from '../state/machine'
import type { Assignment, DisasterEvent, NeedKey } from '../types'
import { distanceKm } from './geo'
import { familiesToMatch, matchFamilies, shelterUsable } from './matching'

const event: DisasterEvent = { id: 'e', source: 'manual', status: 'active', time: '', ...floodScenario }
const ids = familiesToMatch(families, event)
const { placements, unmet } = matchFamilies({ families, shelters, assignments: [], event, familyIds: ids })

assert.equal(placements.length, ids.length, 'safety first: every family in the zone gets a safe shelter with seats')
assert.ok(unmet.every((u) => u.shelterId && u.detail.kind === 'gaps'), 'no backlog while seats exist; only gap records')
// Hasibuan needs a caregiver room and no verified shelter has one: placed now at the nearest safe shelter, gap recorded.
const hasibuan = placements.find((p) => p.familyId === 'fam-09')!
assert.deepEqual([hasibuan.shelterId, hasibuan.reason.gaps], ['sh-03', ['caregiverSpaceNeeded']])
assert.ok(unmet.some((u) => u.familyId === 'fam-09' && u.shelterId === 'sh-03' && u.missingFacilityType === 'caregiver_room'))

const used = new Map<string, { people: number; watt: number }>()
for (const p of placements) {
  const f = families.find((x) => x.id === p.familyId)!
  const s = shelters.find((x) => x.id === p.shelterId)!
  assert.ok(p.reason.inZone || shelterUsable(s, event), `${s.id} must be open, verified and outside the zone unless flagged`)
  const gap = (n: NeedKey) => !!p.reason.gaps?.includes(n) // a recorded gap is the only allowed exception
  if (f.needs.noStairsRequired && !gap('noStairsRequired')) assert.ok(s.features.hasRamp && s.features.rampSlopeCompliant && s.features.doorWidthAccessible)
  if (f.needs.accessibleToiletNeeded && !gap('accessibleToiletNeeded')) assert.ok(s.features.hasAccessibleToilet)
  if (f.needs.caregiverSpaceNeeded && !gap('caregiverSpaceNeeded')) assert.ok(s.features.hasCaregiverRooms)
  if (f.needs.medicalPowerRequired && !gap('medicalPowerRequired')) assert.ok(s.features.hasMedicalPower)
  const u = used.get(s.id) ?? { people: 0, watt: 0 }
  u.people += f.memberCount
  u.watt += f.needs.medicalPowerRequired && !gap('medicalPowerRequired') ? f.needs.minPowerWattage : 0
  used.set(s.id, u)
}
for (const [id, u] of used) {
  const s = shelters.find((x) => x.id === id)!
  assert.ok(s.currentOccupancy + u.people <= s.totalCapacity, `${id} overbooked`)
  assert.ok(u.watt <= s.features.backupGeneratorCapacityWatt, `${id} power overbooked`)
}

// Second run with the first run's reservations must not double-book.
const held: Assignment[] = placements.map((p, i) => ({
  id: `a${i}`, familyId: p.familyId, shelterId: p.shelterId, status: 'recommended', reason: '', distanceKm: 0, createdAt: '', softLockExpiresAt: '',
}))
const again = matchFamilies({ families, shelters, assignments: held, event, familyIds: ['fam-09'], excluded: { 'fam-09': ['sh-03'] }, strict: true })
assert.deepEqual([again.placements.length, again.unmet.length], [0, 0], 'referral moves a family only to a shelter that meets every need')
const sh04 = shelters.map((x) => (x.id === 'sh-04' ? { ...x, verificationStatus: 'verified' as const } : x))
const referred = matchFamilies({ families, shelters: sh04, assignments: held, event, familyIds: ['fam-09'], excluded: { 'fam-09': ['sh-03'] }, strict: true })
assert.equal(referred.placements[0]?.shelterId, 'sh-04', 'once a fitting shelter is verified the referral succeeds')

// RISET §3.2: a location reported during the emergency is the pickup point; home stays registered.
const away = { ...families[0], currentLat: 3.605, currentLng: 98.635 }
assert.equal(familiesToMatch([away], event).length, 0, 'family reported outside the zone is not evacuated from home')
assert.equal(familiesToMatch([families[0]], event).length, 1)

assert.ok(canTransition('recommended', 'confirmed'))
assert.ok(!canTransition('recommended', 'in_transit'), 'RULE 5: no departure before confirmation')
assert.ok(!canTransition('arrived', 'recommended'))
assert.ok(canTransition('arrived', 'reallocated'), 'referral after arrival')
assert.ok(!vehicleFits(families[0], 'standard_car'), 'NAV-3')
assert.ok(vehicleFits(families[0], 'wheelchair_accessible_van'))

// CONF-2: only unanswered recommendations past their soft-lock expire.
const lock = (status: Assignment['status'], softLockExpiresAt: string) => ({ ...held[0], status, softLockExpiresAt })
const at = '2026-10-17T10:15:00.000Z'
assert.equal(
  expiredLocks([lock('recommended', '2026-10-17T10:14:59.000Z'), lock('recommended', '2026-10-17T10:16:00.000Z'), lock('confirmed', '2026-10-17T10:00:00.000Z'), lock('recommended', '')], at).length,
  1,
  'expired recommendation is released; pending, confirmed and lock-less ones are kept',
)

// City-wide hazard: every shelter is inside the zone, so families still go to the nearest open, verified one, flagged.
const cityWide: DisasterEvent = { ...event, radiusKm: 100 }
const wide = matchFamilies({ families, shelters, assignments: [], event: cityWide, familyIds: familiesToMatch(families, cityWide) })
assert.equal(wide.unmet.filter((u) => !u.shelterId).length, 0, 'no backlog just because the zone covers every shelter')
assert.ok(wide.placements.length > 0 && wide.placements.every((p) => p.reason.inZone), 'in-zone placements are flagged')

console.log(`ok — ${placements.length} placed, temporary with gaps:`, unmet.map((u) => `${u.familyId} @ ${u.shelterId} (${u.missingFacilityType})`).join(', '))
for (const p of placements) console.log(' ', p.familyId, '→', p.shelterId)
