// Assert-based self-check: `npm run check`. Verifies hard constraints (MTCH-2), no overbooking, and the state machine.
import assert from 'node:assert/strict'
import { families, floodScenario, shelters } from '../data/mock'
import { canTransition, expiredLocks, vehicleFits } from '../state/machine'
import type { Assignment, DisasterEvent } from '../types'
import { distanceKm } from './geo'
import { familiesToMatch, matchFamilies, shelterUsable } from './matching'

const event: DisasterEvent = { id: 'e', source: 'manual', status: 'active', time: '', ...floodScenario }
const ids = familiesToMatch(families, event)
const { placements, unmet } = matchFamilies({ families, shelters, assignments: [], event, familyIds: ids })

assert.equal(placements.length + unmet.length, ids.length, 'every family is either placed or in the backlog')

const used = new Map<string, { people: number; watt: number }>()
for (const p of placements) {
  const f = families.find((x) => x.id === p.familyId)!
  const s = shelters.find((x) => x.id === p.shelterId)!
  assert.ok(shelterUsable(s, event), `${s.id} must be open, verified and outside the zone`)
  assert.ok(distanceKm(s, event) > event.radiusKm)
  if (f.needs.noStairsRequired) assert.ok(s.features.hasRamp && s.features.rampSlopeCompliant && s.features.doorWidthAccessible)
  if (f.needs.accessibleToiletNeeded) assert.ok(s.features.hasAccessibleToilet)
  if (f.needs.caregiverSpaceNeeded) assert.ok(s.features.hasCaregiverRooms)
  if (f.needs.medicalPowerRequired) assert.ok(s.features.hasMedicalPower)
  const u = used.get(s.id) ?? { people: 0, watt: 0 }
  u.people += f.memberCount
  u.watt += f.needs.medicalPowerRequired ? f.needs.minPowerWattage : 0
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
const again = matchFamilies({ families, shelters, assignments: held, event, familyIds: unmet.map((u) => u.familyId) })
assert.equal(again.placements.length, 0, 'unmet families stay unmet when nothing changed')

// RISET §3.2: a location reported during the emergency is the pickup point; home stays registered.
const away = { ...families[0], currentLat: 3.605, currentLng: 98.635 }
assert.equal(familiesToMatch([away], event).length, 0, 'family reported outside the zone is not evacuated from home')
assert.equal(familiesToMatch([families[0]], event).length, 1)

assert.ok(canTransition('recommended', 'confirmed'))
assert.ok(!canTransition('recommended', 'in_transit'), 'RULE 5: no departure before confirmation')
assert.ok(!canTransition('arrived', 'recommended'))
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

console.log(`ok — ${placements.length} placed, ${unmet.length} unmet:`, unmet.map((u) => `${u.familyId} (${u.missingFacilityType})`).join(', '))
for (const p of placements) console.log(' ', p.familyId, '→', p.shelterId)
