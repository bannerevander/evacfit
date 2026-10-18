// One way for every role to set a location (RISET-Skala-Universal.md §3.3). DESIGN.md: the map is never the only way,
// so GPS, address search and manual coordinates come first, and a text card confirms the chosen point and its service area.
import L from 'leaflet'
import { LocateFixed, MapPin, Search, TriangleAlert } from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import { useT } from '../i18n'
import { areaAt, dataMode } from '../state/remote'
import type { LatLng } from '../types'
import { Button, TextInput } from './ui'

export function useLocate(onFound: (lat: number, lng: number, accuracyM: number) => void) {
  const d = useT()
  const [state, setState] = useState<'' | keyof typeof d.locate>('')
  const locate = () => {
    if (!navigator.geolocation) return setState('unsupported')
    setState('pending')
    navigator.geolocation.getCurrentPosition(
      (p) => {
        onFound(+p.coords.latitude.toFixed(5), +p.coords.longitude.toFixed(5), Math.round(p.coords.accuracy))
        setState('ok')
      },
      () => setState('failed'),
      { enableHighAccuracy: true, timeout: 10_000 },
    )
  }
  return { msg: state ? d.locate[state] : '', locate }
}

interface Place extends LatLng {
  label: string
}

// shortcut: public Photon (OSM) instance, fair-use and rate-limited; self-host per region before real deployment (RISET §2.3).
const PHOTON = 'https://photon.komoot.io'

function placeLabel(p: Record<string, string | undefined>): string {
  const street = p.street && (p.housenumber ? `${p.street} ${p.housenumber}` : p.street)
  return [...new Set([p.name, street, p.district, p.city ?? p.county, p.state].filter(Boolean))].join(', ')
}

async function photon(path: string, signal: AbortSignal): Promise<Place[]> {
  const res = await fetch(`${PHOTON}${path}`, { signal })
  if (!res.ok) throw new Error(String(res.status))
  const json = (await res.json()) as { features: { geometry: { coordinates: [number, number] }; properties: Record<string, string> }[] }
  return json.features.map((f) => ({ lng: f.geometry.coordinates[0], lat: f.geometry.coordinates[1], label: placeLabel(f.properties) }))
}

const pin = L.divIcon({
  className: '',
  html: '<div class="ef-pin" style="background:#1D4ED8"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#fff" stroke-width="2.5" aria-hidden="true"><circle cx="12" cy="12" r="4"/></svg></div>',
  iconSize: [34, 34],
  iconAnchor: [17, 17],
})

function Follow({ at }: { at: LatLng }) {
  const map = useMap()
  // Inside a dialog the map mounts before it has a size; re-measure whenever the container resizes.
  useEffect(() => {
    const ro = new ResizeObserver(() => map.invalidateSize())
    ro.observe(map.getContainer())
    return () => ro.disconnect()
  }, [map])
  useEffect(() => {
    map.setView([at.lat, at.lng], Math.max(map.getZoom(), 15))
  }, [map, at.lat, at.lng])
  return null
}

function ClickToSet({ onPick }: { onPick: (p: LatLng) => void }) {
  useMapEvents({ click: (e) => onPick({ lat: +e.latlng.lat.toFixed(5), lng: +e.latlng.lng.toFixed(5) }) })
  return null
}

export function LocationPicker({ value, onChange, big }: { value: LatLng; onChange: (p: LatLng) => void; big?: boolean }) {
  const d = useT()
  const p = d.picker
  const [accuracy, setAccuracy] = useState<number>()
  const { msg, locate } = useLocate((lat, lng, acc) => {
    setAccuracy(acc)
    onChange({ lat, lng })
  })
  const set = (pt: LatLng) => {
    setAccuracy(undefined) // accuracy only describes a GPS fix
    onChange(pt)
  }

  // Address search, debounced; Photon is biased towards the current point.
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Place[]>()
  const [searchState, setSearchState] = useState<'' | 'searching' | 'failed'>('')
  useEffect(() => {
    if (q.trim().length < 3) return setResults(undefined)
    const ac = new AbortController()
    const t = window.setTimeout(() => {
      setSearchState('searching')
      photon(`/api/?q=${encodeURIComponent(q)}&limit=5&lat=${value.lat}&lon=${value.lng}`, ac.signal)
        .then((r) => { setResults(r); setSearchState('') })
        .catch(() => { if (!ac.signal.aborted) setSearchState('failed') })
    }, 500)
    return () => { window.clearTimeout(t); ac.abort() }
  }, [q]) // re-search when the text changes, not on every pin move

  // Confirmation card: nearest place name + which service area the point is in.
  const [near, setNear] = useState<string>()
  const [area, setArea] = useState<{ id: string; name: string } | null>()
  useEffect(() => {
    const ac = new AbortController()
    const t = window.setTimeout(() => {
      photon(`/reverse?lat=${value.lat}&lon=${value.lng}`, ac.signal).then((r) => setNear(r[0]?.label)).catch(() => setNear(undefined))
      if (dataMode === 'supabase') areaAt(value).then((a) => !ac.signal.aborted && setArea(a)).catch(() => setArea(undefined))
    }, 600)
    return () => { window.clearTimeout(t); ac.abort() }
  }, [value.lat, value.lng])

  const acc = accuracy === undefined ? undefined : accuracy < 30 ? 'good' : accuracy < 100 ? 'fair' : 'weak'
  const listId = useId()
  return (
    <div className="flex flex-col gap-md">
      <div>
        <Button size={big ? 'lg' : 'md'} block={big} icon={LocateFixed} onClick={locate}>{p.useMine}</Button>
        <p role="status" className="mt-xs text-body-sm text-text-secondary">{msg}</p>
      </div>

      <div>
        <TextInput
          label={p.search}
          helper={p.searchHint}
          type="search"
          autoComplete="off"
          aria-controls={listId}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div id={listId} aria-live="polite">
          {searchState === 'searching' && <p className="mt-xs text-body-sm text-text-secondary">{p.searching}</p>}
          {searchState === 'failed' && <p className="mt-xs text-body-sm text-status-rejected">{p.searchFailed}</p>}
          {results?.length === 0 && <p className="mt-xs text-body-sm text-text-secondary">{p.noResults}</p>}
          {!!results?.length && (
            <ul className="mt-xs flex flex-col overflow-hidden rounded-md border border-border">
              {results.map((r) => (
                <li key={`${r.lat},${r.lng}`} className="border-b border-border last:border-b-0">
                  <button
                    type="button"
                    onClick={() => { set(r); setQ(''); setResults(undefined) }}
                    className="pressable flex min-h-12 w-full cursor-pointer items-center gap-sm bg-background px-md py-sm text-left text-body-md hover:bg-surface-subtle"
                  >
                    <Search aria-hidden className="h-4 w-4 shrink-0 text-text-secondary" />{r.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="map-only overflow-hidden rounded-lg border border-border" role="region" aria-label={p.mapLabel}>
        <MapContainer center={[value.lat, value.lng]} zoom={15} scrollWheelZoom={false} style={{ height: 'clamp(200px, 32vh, 280px)' }}>
          <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <Follow at={value} />
          <ClickToSet onPick={set} />
          <Marker
            position={[value.lat, value.lng]}
            icon={pin}
            draggable
            title={p.chosen}
            eventHandlers={{ dragend: (e) => { const ll = (e.target as L.Marker).getLatLng(); set({ lat: +ll.lat.toFixed(5), lng: +ll.lng.toFixed(5) }) } }}
          />
        </MapContainer>
        <p className="border-t border-border bg-surface px-md py-xs text-caption text-text-secondary">{p.mapHint}</p>
      </div>

      {/* Text alternative to the map: what was chosen, where it is, and whether EvacFit serves it. */}
      <div role="status" aria-live="polite" className={`rounded-lg border-l-4 p-md ${area === null ? 'border-status-rejected bg-tint-rejected' : 'border-primary bg-surface'}`}>
        <p className="flex items-center gap-xs text-body-sm font-semibold uppercase text-text-secondary"><MapPin aria-hidden className="h-4 w-4" />{p.chosen}</p>
        <p className="mt-xs text-body-md font-semibold text-text-primary">{near ? p.near(near) : `${value.lat.toFixed(5)}, ${value.lng.toFixed(5)}`}</p>
        {area && <p className="text-body-md text-text-primary">{p.area(area.name)}</p>}
        {area === null && <p className="mt-xs flex gap-xs text-body-md text-status-rejected"><TriangleAlert aria-hidden className="mt-0.5 h-5 w-5 shrink-0" />{p.outside}</p>}
        {acc && <p className={`mt-xs text-body-sm ${acc === 'weak' ? 'font-semibold text-status-rejected' : 'text-text-secondary'}`}>{p.accuracy[acc](accuracy!)}</p>}
      </div>

      <details className="rounded-lg border border-border bg-background p-md">
        <summary className="min-h-12 cursor-pointer py-sm text-body-md font-semibold text-primary">{p.manual}</summary>
        <div className="mt-sm grid gap-md sm:grid-cols-2">
          <TextInput label={p.lat} type="number" step="0.00001" value={value.lat} onChange={(e) => set({ ...value, lat: Number(e.target.value) })} />
          <TextInput label={p.lng} type="number" step="0.00001" value={value.lng} onChange={(e) => set({ ...value, lng: Number(e.target.value) })} />
        </div>
      </details>
      <p className="text-caption text-text-secondary">{p.attribution}</p>
    </div>
  )
}
