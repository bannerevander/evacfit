import type { Assignment, AssignmentStatus, Family, VehicleType } from '../types'

/** Closed-loop state machine (PRD §6.5 MTCH-6, AGENT.md §3.3). Terminal: rejected, reallocated; arrived only moves on by referral. */
const transitions: Record<AssignmentStatus, AssignmentStatus[]> = {
  recommended: ['confirmed', 'rejected', 'reallocated'],
  confirmed: ['in_transit', 'rejected', 'reallocated'],
  in_transit: ['arrived', 'reallocated'],
  arrived: ['reallocated'], // referral to a shelter that meets every need
  rejected: [],
  reallocated: [],
}

export function canTransition(from: AssignmentStatus, to: AssignmentStatus): boolean {
  return transitions[from].includes(to)
}

/** NAV-3: wheelchair users must get a vehicle that can carry a wheelchair. */
export function vehicleFits(family: Family, vehicle: VehicleType): boolean {
  return !family.needs.wheelchairVehicleNeeded || vehicle === 'wheelchair_accessible_van' || vehicle === 'ambulance'
}

export const SOFT_LOCK_MINUTES = 15 // PRD §12 leaves this TBD; 15 is the PRD's own example.

/** CONF-2: recommendations the shelter left unanswered past the soft-lock release their reservation. */
export function expiredLocks(assignments: Assignment[], at: string): Assignment[] {
  return assignments.filter((a) => a.status === 'recommended' && !!a.softLockExpiresAt && a.softLockExpiresAt <= at)
}
