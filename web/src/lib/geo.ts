import { fmtNum, fmtTime } from '../i18n/format'
import type { Family, FunctionalNeeds, LatLng } from '../types'

/** Pickup point: the location reported during the emergency, else the registered home (mirrors family_units.geog). */
export function pickupOf(f: Family): LatLng {
  return f.currentLat != null && f.currentLng != null ? { lat: f.currentLat, lng: f.currentLng } : f
}

/** Straight-line distance. Real route distance comes from OpenRouteService once the backend exists. */
export function distanceKm(a: LatLng, b: LatLng): number {
  const R = 6371
  const rad = (d: number) => (d * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

/** Higher score = more constrained family; used for ordering and ETA slowdown. */
export function vulnerabilityScore(n: FunctionalNeeds): number {
  return (
    (n.medicalPowerRequired ? 3 : 0) +
    (n.chronicCareNeeded ? 2 : 0) +
    (n.noStairsRequired ? 2 : 0) +
    (n.wheelchairVehicleNeeded ? 2 : 0) +
    (n.accessibleToiletNeeded ? 1 : 0) +
    (n.caregiverSpaceNeeded ? 1 : 0) +
    (n.pregnantCount > 0 ? 1 : 0) +
    (n.infantCount > 0 ? 1 : 0)
  )
}

/** NAV-6: AGENT.md §2.3 slowdown factor 1.5×–2.5× for vulnerable groups. */
export function etaMinutes(distance: number, needs: FunctionalNeeds): number {
  const score = vulnerabilityScore(needs)
  const factor = score >= 6 ? 2.5 : score >= 3 ? 2 : score > 0 ? 1.5 : 1
  const roadKm = distance * 1.3 // shortcut: fixed detour factor until ORS route distance is wired in
  return Math.round((roadKm / 20) * 60 * factor + 5 * factor)
}

export function formatKm(km: number): string {
  return `${fmtNum(km, 1)} km`
}

export const formatTime = fmtTime
