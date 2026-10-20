import { Accessibility, ChevronDown, ExternalLink, MapPin, Navigation, Phone, Timer, Truck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { NeedBadges, usePersona } from '../components/domain'
import { FamilyForm } from '../components/FamilyForm'
import { MapView } from '../components/MapView'
import { Button, EmptyState, PageHeader, StatusBadge, buttonCls } from '../components/ui'
import { emptyNeeds } from '../data/mock'
import { useT, type Dict } from '../i18n'
import { etaMinutes, formatKm, formatTime, pickupOf } from '../lib/geo'
import { dataMode, fetchRoute, type Route } from '../state/remote'
import { useRegion, useStore } from '../state/store'
import type { Assignment, Family, LatLng } from '../types'

/** Pending field changes. Only shown when something is queued; the connection toggle lives in the top bar. */
function Outbox() {
  const d = useT()
  const { state } = useStore()
  if (!state.outbox.length) return null
  return (
    <section aria-labelledby="antrean" className="mb-lg rounded-lg border-l-4 border-status-recommended bg-tint-recommended p-md">
      <h2 id="antrean" className="text-body-md font-semibold text-status-recommended">{d.relawan.pending(state.outbox.length)}</h2>
      <ul className="mt-xs list-disc pl-lg text-body-sm text-text-primary">
        {state.outbox.map((o) => <li key={o.id}>{d.outbox[o.kind]} · {formatTime(o.at)}</li>)}
      </ul>
    </section>
  )
}

export function RelawanTugas() {
  const d = useT()
  const r = d.relawan
  const { state } = useStore()
  const [me] = usePersona('volunteer')
  const vol = state.volunteers.find((v) => v.id === me) ?? state.volunteers[0]
  const mine = state.assignments.filter((a) => a.volunteerId === vol.id)
  const active = mine.filter((a) => a.status === 'confirmed' || a.status === 'in_transit')
  const done = mine.filter((a) => a.status === 'arrived')
  return (
    <>
      <PageHeader eyebrow={d.roles.field} title={r.title} description={r.lead(vol.name, d.vehicle[vol.vehicleType], vol.plate)} />
      <Outbox />
      {active.length === 0 ? (
        <EmptyState title={r.emptyTitle}>{r.emptyBody}</EmptyState>
      ) : (
        <ul className="flex flex-col gap-lg">
          {active.map((a) => <TaskCard key={a.id} a={a} />)}
        </ul>
      )}
      {done.length > 0 && (
        <section className="mt-xl" aria-labelledby="selesai">
          <h2 id="selesai" className="mb-sm text-h3">{r.doneTitle(done.length)}</h2>
          <ul className="flex flex-col gap-xs text-body-md">
            {done.map((a) => <li key={a.id}>{r.doneRow(state.families.find((f) => f.id === a.familyId)?.familyName ?? '', a.arrivedAt ? formatTime(a.arrivedAt) : '')}</li>)}
          </ul>
        </section>
      )}
    </>
  )
}

/** Google Maps directions to a point; only coordinates leave EvacFit (no name, phone or notes). */
const gmaps = (p: LatLng) => `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}&travelmode=driving`

/**
 * One pickup task. Driving navigation opens Google Maps (free URL, voice turn-by-turn). In supabase mode the volunteer can
 * also load a step-free wheelchair/walking route (ORS) for when the vehicle cannot reach the door (narrow gang, cut road).
 */
function TaskCard({ a }: { a: Assignment }) {
  const d = useT()
  const r = d.relawan
  const { state, dispatch } = useStore()
  const f = state.families.find((x) => x.id === a.familyId)!
  const sh = state.shelters.find((s) => s.id === a.shelterId)!
  const at = pickupOf(f)
  const [open, setOpen] = useState(false)
  const [walk, setWalk] = useState(false)
  const { route, loading } = useRoute(at, sh, walk && !state.offline, state.lang)
  // Vehicle estimate keeps the NAV-6 slowdown for at-risk groups; the wheelchair route already moves at pushing speed.
  const eta = route ? route.minutes : etaMinutes(a.distanceKm, f.needs)
  return (
    <li className="overflow-hidden rounded-lg border border-border bg-background">
      {/* Collapsed by default: a long task list stays scannable; details (and the map) render only when opened. */}
      <details open={open} onToggle={(e) => setOpen(e.currentTarget.open)} className="group">
      <summary className="pressable flex min-h-16 cursor-pointer list-none items-center justify-between gap-sm p-5 hover:bg-surface-subtle [&::-webkit-details-marker]:hidden">
        <div className="min-w-0">
          <h2 className="text-h2">{f.familyName}</h2>
          <p className="text-body-sm text-text-secondary">{d.common.people(f.memberCount)} · <span className="font-mono font-semibold text-text-primary">{f.code}</span> · {sh.name}</p>
        </div>
        <span className="flex shrink-0 items-center gap-sm">
          <StatusBadge status={a.status} />
          <ChevronDown aria-hidden className="h-5 w-5 text-text-secondary transition-transform group-open:rotate-180" />
        </span>
      </summary>
      {open && <div className="grid border-t border-border lg:grid-cols-2">
      <div className="flex flex-col gap-md p-5">
        <p className="text-body-sm text-text-secondary">{f.contactPhone}</p>
        <NeedBadges family={f} />
        <p className="text-body-sm font-semibold">{a.readyForPickupAt ? r.readyAt(formatTime(a.readyForPickupAt)) : r.notReady}</p>
        {/* Actions sit right after the needs and before the address details and map, so on a phone they are visible without scrolling. */}
        <div className="grid gap-sm sm:grid-cols-[2fr_1fr]">
          {a.status === 'confirmed' ? (
            <Button block icon={Truck} onClick={() => dispatch({ type: 'depart', id: a.id })}>{r.depart}</Button>
          ) : (
            <p role="status" className="flex min-h-12 items-center rounded-md bg-tint-in-transit px-md text-body-md font-semibold text-status-in-transit">{r.inTransit(a.departedAt ? formatTime(a.departedAt) : '—')}</p>
          )}
          <a href={`tel:${f.contactPhone.replace(/[^0-9+]/g, '')}`} className={buttonCls('secondary', 'md', true)}><Phone aria-hidden className="h-5 w-5" />{r.call}</a>
        </div>
        <dl className="grid gap-sm rounded-md bg-surface p-md text-body-md">
          <div>
            <dt className="flex items-center gap-xs text-body-sm text-text-secondary"><MapPin aria-hidden className="h-4 w-4" />{r.pickup}</dt>
            <dd className="font-semibold">
              {a.reason.pickupShelter ? r.pickupAtShelter(a.reason.pickupShelter) : f.currentAt ? r.currentPickup(formatTime(f.currentAt)) : f.addressNotes || '—'} <span className="font-mono text-caption text-text-secondary">({at.lat.toFixed(4)}, {at.lng.toFixed(4)})</span>
            </dd>
          </div>
          <div>
            <dt className="flex items-center gap-xs text-body-sm text-text-secondary"><Navigation aria-hidden className="h-4 w-4" />{r.destination}</dt>
            <dd className="font-semibold">{sh.name}<span className="block font-normal text-text-secondary">{sh.address}</span></dd>
          </div>
          <div>
            <dt className="flex items-center gap-xs text-body-sm text-text-secondary"><Timer aria-hidden className="h-4 w-4" />{r.eta}</dt>
            <dd className="font-semibold">{d.common.km(formatKm(route?.km ?? a.distanceKm))} · {d.common.minutes(eta)} <span className="block text-body-sm font-normal text-text-secondary">{route ? r.wheelEtaHint : r.etaHint}</span></dd>
          </div>
        </dl>
      </div>
      <div className="flex flex-col gap-sm border-t border-border bg-surface p-md lg:border-l lg:border-t-0">
        <MapView label={r.mapLabel(f.familyName)} center={at} shelters={[sh]} families={[f]} line={[at, sh]} route={route?.coords} height="clamp(220px, 40vh, 300px)" />
        <p role="status" className="text-body-sm text-text-secondary">
          {loading ? r.routeLoading : route ? r.routeFrom : walk ? r.routeNone : r.routeNote}
        </p>
        {route && route.steps.length > 0 && (
          <details className="rounded-md border border-border bg-background p-sm text-body-sm">
            <summary className="min-h-10 cursor-pointer font-semibold text-text-primary">{r.steps(route.steps.length)}</summary>
            <ol className="mt-xs list-decimal pl-lg">
              {route.steps.map((st, i) => <li key={i}>{st.text}{st.m > 0 && <span className="text-text-secondary"> · {st.m >= 1000 ? d.common.km(formatKm(st.m / 1000)) : `${st.m} m`}</span>}</li>)}
            </ol>
          </details>
        )}
        {dataMode === 'supabase' && (
          <Button variant="secondary" block icon={Accessibility} aria-pressed={walk} onClick={() => setWalk(!walk)} disabled={state.offline}>
            {walk ? r.walkHide : r.walkShow}
          </Button>
        )}
        {/* Decision (BUG-002): only coordinates go to Google; the family's name, phone and notes stay in EvacFit. */}
        <div className="grid gap-sm sm:grid-cols-2">
          <a href={gmaps(at)} target="_blank" rel="noreferrer" className={buttonCls('primary', 'md', true)}><Navigation aria-hidden className="h-5 w-5" />{r.navPickup}</a>
          <a href={gmaps(sh)} target="_blank" rel="noreferrer" className={buttonCls('secondary', 'md', true)}><ExternalLink aria-hidden className="h-5 w-5" />{r.navShelter}</a>
        </div>
        <p className="text-caption text-text-secondary">{r.navHint}</p>
      </div>
      </div>}
      </details>
    </li>
  )
}

/** Step-free wheelchair/walking route (ORS), loaded only when asked; offline or failing: none (dashed guide). */
function useRoute(from: LatLng, to: LatLng, on: boolean, lang: 'id' | 'en') {
  const [res, setRes] = useState<{ key: string; route: Route | null }>()
  const key = `${from.lat},${from.lng},${to.lat},${to.lng},${lang}`
  useEffect(() => {
    if (dataMode !== 'supabase' || !on || res?.key === key) return
    let live = true
    fetchRoute(from, to, 'wheelchair', lang).then((route) => live && setRes({ key, route })).catch(() => live && setRes({ key, route: null }))
    return () => { live = false }
  }, [key, on]) // eslint-disable-line react-hooks/exhaustive-deps -- key covers from/to/lang
  const cur = on && res?.key === key ? res : undefined
  return { route: cur?.route ?? undefined, loading: on && dataMode === 'supabase' && !cur }
}

const triageFamily = (d: Dict, center: LatLng): Family => {
  const id = crypto.randomUUID()
  return {
    id, code: `OFF-${id.slice(0, 4).toUpperCase()}`, familyName: '', memberCount: 1, contactPhone: '', lat: center.lat, lng: center.lng,
    addressNotes: d.relawan.triagePickup, status: 'idle', needs: { ...emptyNeeds }, registeredVia: 'field_triage',
  }
}

export function RelawanTriage() {
  const { center } = useRegion()
  const d = useT()
  const r = d.relawan
  const { state, dispatch } = useStore()
  const [formKey, setFormKey] = useState(0)
  const [saved, setSaved] = useState<{ code: string; offline: boolean } | null>(null)
  // outbox is flushed all at once on reconnect (store.tsx), so an empty outbox means this triage synced
  useEffect(() => { if (!state.outbox.length) setSaved((v) => v && { ...v, offline: false }) }, [state.outbox.length])
  return (
    <>
      <PageHeader eyebrow={d.roles.field} title={r.triageTitle} description={r.triageLead} />
      <Outbox />
      {saved && (
        <div role="status" className="mb-lg rounded-lg border-l-4 border-status-arrived bg-tint-arrived p-md text-body-md text-status-arrived">
          <p className="font-semibold">{r.triageSaved(saved.code)}</p>
          <p>{saved.offline ? r.triagePending : r.triageSent}</p>
        </div>
      )}
      <FamilyForm
        key={formKey}
        initial={triageFamily(d, center)}
        submitLabel={r.triageSubmit}
        onSaved={(f) => {
          dispatch({ type: 'save_family', family: f })
          setSaved({ code: f.code, offline: state.offline })
          setFormKey((k) => k + 1)
          window.scrollTo({ top: 0 })
        }}
      />
    </>
  )
}
