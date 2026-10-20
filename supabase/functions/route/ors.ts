// Pure helpers for the route function: request validation and OpenRouteService GeoJSON → compact route.

export const PROFILES = ['wheelchair', 'driving-car'] as const
export type Profile = (typeof PROFILES)[number]

export interface RouteRequest {
  from: { lat: number; lng: number }
  to: { lat: number; lng: number }
  profile: Profile
  lang: 'id' | 'en'
}

export interface Route {
  km: number
  minutes: number
  /** [lat, lng] pairs, ready for Leaflet. */
  coords: [number, number][]
  steps: { text: string; m: number }[]
}

const point = (p: unknown) => {
  const { lat, lng } = (p ?? {}) as { lat?: unknown; lng?: unknown }
  return typeof lat === 'number' && typeof lng === 'number' && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null
}

/** Trust boundary: anything malformed is rejected before it reaches ORS (and the quota). */
export function parseRequest(body: unknown): RouteRequest | null {
  const b = (body ?? {}) as Record<string, unknown>
  const from = point(b.from)
  const to = point(b.to)
  const profile = PROFILES.find((p) => p === b.profile)
  if (!from || !to || !profile) return null
  return { from, to, profile, lang: b.lang === 'en' ? 'en' : 'id' }
}

interface OrsStep { instruction: string; distance: number }
interface OrsFeature {
  geometry: { coordinates: [number, number][] }
  properties: { summary: { distance: number; duration: number }; segments: { steps: OrsStep[] }[] }
}

export function toRoute(geojson: unknown): Route | null {
  const f = (geojson as { features?: OrsFeature[] })?.features?.[0]
  if (!f?.geometry?.coordinates?.length) return null
  const { distance, duration } = f.properties.summary
  return {
    km: Math.round(distance / 100) / 10,
    minutes: Math.round(duration / 60),
    coords: f.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
    steps: f.properties.segments.flatMap((s) => s.steps).map((s) => ({ text: s.instruction, m: Math.round(s.distance) })),
  }
}
