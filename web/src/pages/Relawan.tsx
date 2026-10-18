import { ExternalLink, MapPin, Navigation, Phone, Timer, Truck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { NeedBadges, usePersona } from '../components/domain'
import { FamilyForm } from '../components/FamilyForm'
import { MapView } from '../components/MapView'
import { Button, EmptyState, PageHeader, StatusBadge, buttonCls } from '../components/ui'
import { emptyNeeds } from '../data/mock'
import { useT, type Dict } from '../i18n'
import { etaMinutes, formatKm, formatTime } from '../lib/geo'
import { useRegion, useStore } from '../state/store'
import type { Family, LatLng } from '../types'

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
  const { state, dispatch } = useStore()
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
          {active.map((a) => {
            const f = state.families.find((x) => x.id === a.familyId)!
            const sh = state.shelters.find((s) => s.id === a.shelterId)!
            const eta = etaMinutes(a.distanceKm, f.needs)
            return (
              <li key={a.id} className="grid overflow-hidden rounded-lg border border-border bg-background lg:grid-cols-2">
                <div className="flex flex-col gap-md p-5">
                  <div className="flex flex-wrap items-start justify-between gap-sm">
                    <div>
                      <h2 className="text-h2">{f.familyName}</h2>
                      <p className="text-body-sm text-text-secondary">{d.common.people(f.memberCount)} · <span className="font-mono font-semibold text-text-primary">{f.code}</span> · {f.contactPhone}</p>
                    </div>
                    <StatusBadge status={a.status} />
                  </div>
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
                      <dd className="font-semibold">{f.addressNotes || '—'} <span className="font-mono text-caption text-text-secondary">({f.lat.toFixed(4)}, {f.lng.toFixed(4)})</span></dd>
                    </div>
                    <div>
                      <dt className="flex items-center gap-xs text-body-sm text-text-secondary"><Navigation aria-hidden className="h-4 w-4" />{r.destination}</dt>
                      <dd className="font-semibold">{sh.name}<span className="block font-normal text-text-secondary">{sh.address}</span></dd>
                    </div>
                    <div>
                      <dt className="flex items-center gap-xs text-body-sm text-text-secondary"><Timer aria-hidden className="h-4 w-4" />{r.eta}</dt>
                      <dd className="font-semibold">{d.common.km(formatKm(a.distanceKm))} · {d.common.minutes(eta)} <span className="block text-body-sm font-normal text-text-secondary">{r.etaHint}</span></dd>
                    </div>
                  </dl>
                </div>
                <div className="flex flex-col gap-sm border-t border-border bg-surface p-md lg:border-l lg:border-t-0">
                  <MapView label={r.mapLabel(f.familyName)} center={f} shelters={[sh]} families={[f]} line={[f, sh]} height="clamp(220px, 40vh, 300px)" />
                  <p className="text-body-sm text-text-secondary">{r.routeNote}</p>
                  <a
                    className="inline-flex min-h-12 items-center gap-sm self-start rounded-md px-sm font-semibold text-primary underline"
                    href={`https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=${f.lat},${f.lng};${sh.lat},${sh.lng}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <ExternalLink aria-hidden className="h-4 w-4" />{r.osm}
                  </a>
                </div>
              </li>
            )
          })}
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
