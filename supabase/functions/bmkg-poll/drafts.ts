// EMER-2: turn BMKG open-data quake items into draft disaster_events rows. Pure, so it is tested without network.
export interface BmkgItem {
  DateTime: string
  Coordinates: string
  Magnitude: string
  Kedalaman: string
  Wilayah: string
  Dirasakan?: string
}

export interface WorkArea {
  lat: number
  lng: number
  km: number
}

export interface DraftRow {
  id: string
  external_event_id: string
  source: 'bmkg'
  type: 'earthquake'
  title: string
  magnitude: number
  depth_km: number
  lat: number
  lng: number
  radius_km: number
  status: 'draft'
  time: string
}

/** Drafts older than this are not created, and open ones are closed: the coordinator only sees live alerts. */
export const FRESH_HOURS = 24

function km(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = (d: number) => (d * Math.PI) / 180
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(h))
}

/** shortcut: starting radius doubles per magnitude step (M5 = 10 km); the coordinator adjusts it before approving (EMER-3). */
export function draftRadiusKm(m: number): number {
  return Math.min(100, Math.max(5, Math.round(10 * 2 ** (m - 5))))
}

/** EMER-2 filter: M > 5.0 or felt, inside the work area, within the freshness window. */
export function toDrafts(items: BmkgItem[], felt: boolean, area: WorkArea, now: Date): DraftRow[] {
  const out: DraftRow[] = []
  for (const g of items) {
    const [lat, lng] = g.Coordinates.split(',').map(Number)
    const magnitude = parseFloat(g.Magnitude)
    const time = new Date(g.DateTime)
    if (![lat, lng, magnitude, time.getTime()].every(Number.isFinite)) continue
    if (!(magnitude > 5 || felt)) continue
    if (now.getTime() - time.getTime() > FRESH_HOURS * 3_600_000) continue
    if (km(area, { lat, lng }) > area.km) continue
    const ext = `bmkg-${time.toISOString()}`
    out.push({
      id: ext,
      external_event_id: ext,
      source: 'bmkg',
      type: 'earthquake',
      title: `Gempa M${magnitude.toFixed(1).replace('.', ',')} — ${g.Wilayah}`,
      magnitude,
      depth_km: parseFloat(g.Kedalaman) || 0,
      lat,
      lng,
      radius_km: draftRadiusKm(magnitude),
      status: 'draft',
      time: time.toISOString(),
    })
  }
  return out
}
