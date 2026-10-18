import L from 'leaflet'
import { Circle, MapContainer, Marker, Polyline, TileLayer, Tooltip } from 'react-leaflet'
import { useT } from '../i18n'
import { useRegion } from '../state/store'
import type { DisasterEvent, Family, LatLng, Shelter } from '../types'

// Colours come from DESIGN.md tokens (status palette); markers are flat with a hairline ring, no blurred shadow.
const shelterColor = (s: Shelter) =>
  s.operationalStatus !== 'open' ? '#475569' : s.verificationStatus === 'verified' ? '#1D4ED8' : '#9A3412'

const familyColor = (f: Family) =>
  f.status === 'arrived' ? '#166534' : f.status === 'waiting_match' ? '#9A3412' : f.status === 'in_transit' ? '#4F46E5' : f.status === 'confirmed' ? '#1E40AF' : '#92400E'

const house =
  '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>'

const shelterIcon = (color: string) => L.divIcon({ className: '', html: `<div class="ef-pin" style="background:${color}">${house}</div>`, iconSize: [34, 34], iconAnchor: [17, 17] })
const familyIcon = (color: string) => L.divIcon({ className: '', html: `<div class="ef-dot" style="background:${color}"></div>`, iconSize: [18, 18], iconAnchor: [9, 9] })

/**
 * Leaflet map. DESIGN.md: the map is never the only way to read this data — every page
 * that shows it also renders a text list, and "Large Text" mode hides it (.map-only).
 */
export function MapView({ event, shelters = [], families = [], line, center, height = 360, label, bare }: {
  event?: DisasterEvent
  shelters?: Shelter[]
  families?: Family[]
  line?: [LatLng, LatLng]
  center?: LatLng
  /** px number or any CSS length (e.g. clamp()) so the map can follow the viewport. */
  height?: number | string
  label: string
  /** Inside a Panel: no own border/radius. */
  bare?: boolean
}) {
  const d = useT()
  const region = useRegion()
  const c = center ?? event ?? shelters[0] ?? region.center
  return (
    <div className={`map-only relative isolate overflow-hidden ${bare ? '' : 'rounded-lg border border-border'}`} role="region" aria-label={d.a11y.mapRegion(label)}>
      <MapContainer center={[c.lat, c.lng]} zoom={13} scrollWheelZoom={false} style={{ height }}>
        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {event && (
          <Circle center={[event.lat, event.lng]} radius={event.radiusKm * 1000} pathOptions={{ color: '#DC2626', weight: 2, dashArray: '6 6', fillOpacity: 0.1 }}>
            <Tooltip>{d.map.hazard(event.title)}</Tooltip>
          </Circle>
        )}
        {families.map((f) => (
          <Marker key={f.id} position={[f.lat, f.lng]} icon={familyIcon(familyColor(f))} title={f.familyName} alt={f.familyName}>
            <Tooltip>{f.familyName}</Tooltip>
          </Marker>
        ))}
        {shelters.map((s) => (
          <Marker key={s.id} position={[s.lat, s.lng]} icon={shelterIcon(shelterColor(s))} title={s.name} alt={s.name}>
            <Tooltip>{s.name}</Tooltip>
          </Marker>
        ))}
        {line && (
          <Polyline positions={line.map((p) => [p.lat, p.lng] as [number, number])} pathOptions={{ color: '#1D4ED8', weight: 3, dashArray: '6 8' }}>
            <Tooltip>{d.map.guide}</Tooltip>
          </Polyline>
        )}
      </MapContainer>
    </div>
  )
}

export function MapLegend() {
  const d = useT()
  const items = [
    { cls: 'rounded-md bg-primary', label: d.map.legendVerified },
    { cls: 'rounded-md bg-status-unverified', label: d.map.legendUnverified },
    { cls: 'rounded-md bg-text-secondary', label: d.map.legendClosed },
    { cls: 'rounded-full bg-status-recommended ring-2 ring-background ring-offset-1 ring-offset-text-secondary', label: d.map.legendFamily },
    { cls: 'rounded-full border-2 border-dashed border-accent-emergency', label: d.map.legendHazard },
  ]
  return (
    <ul className="flex flex-wrap gap-x-md gap-y-xs text-body-sm text-text-secondary">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-xs"><span aria-hidden className={`h-3.5 w-3.5 ${i.cls}`} />{i.label}</li>
      ))}
    </ul>
  )
}
