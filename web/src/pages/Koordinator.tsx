import {
  AlertOctagon, BarChart3, Building2, CircleCheckBig, Clock3, Download, Hourglass, Map as MapIcon, Play, Power, Printer, RadioTower, RefreshCw, ShieldCheck,
  ShieldOff, Siren, Truck, UserCheck, Users, type LucideIcon,
} from 'lucide-react'
import { useState } from 'react'
import { NeedBadges, ShelterCard } from '../components/domain'
import { MapLegend, MapView } from '../components/MapView'
import { Button, Card, Dialog, EmptyState, IconChip, Meter, PageHeader, Panel, Select, StatusBadge, TextInput, type Tone } from '../components/ui'
import { region } from '../config'
import { floodScenario } from '../data/mock'
import { dataMode } from '../state/remote'
import { useT, type Dict } from '../i18n'
import { fmtNum } from '../i18n/format'
import { distanceKm, formatTime } from '../lib/geo'
import { shelterLoad } from '../lib/matching'
import { vehicleFits } from '../state/machine'
import { activeEvent, currentAssignment, useStore } from '../state/store'
import type { DisasterEvent, DisasterType, Family, Severity, UnmetNeed } from '../types'

const severityCls: Record<Severity, string> = {
  critical: 'bg-tint-rejected text-status-rejected',
  high: 'bg-tint-unverified text-status-unverified',
  medium: 'bg-tint-recommended text-status-recommended',
  low: 'bg-surface-subtle text-text-secondary',
}

function SeverityBadge({ s }: { s: Severity }) {
  const d = useT()
  return <span className={`inline-flex rounded-full px-[10px] py-xs text-body-sm font-semibold ${severityCls[s]}`}>{d.severity[s]}</span>
}

function ActivateDialog({ open, onClose, draft }: { open: boolean; onClose: () => void; draft?: DisasterEvent }) {
  const d = useT()
  const k = d.koord
  const { dispatch } = useStore()
  // Demo mode pre-fills the rehearsed flood scenario; the live app starts from the region centre with a blank title.
  const prefill = dataMode === 'demo' ? floodScenario : { type: 'flood' as const, title: '', ...region.center, radiusKm: 2 }
  const [type, setType] = useState<DisasterType>(draft?.type ?? prefill.type)
  const [title, setTitle] = useState(draft?.title ?? prefill.title)
  const [lat, setLat] = useState(draft?.lat ?? prefill.lat)
  const [lng, setLng] = useState(draft?.lng ?? prefill.lng)
  const [radius, setRadius] = useState(draft?.radiusKm ?? prefill.radiusKm)
  return (
    <Dialog open={open} onClose={onClose} title={draft ? k.dialogBmkg : k.dialogManual}>
      <form
        className="flex flex-col gap-md"
        onSubmit={(e) => {
          e.preventDefault()
          dispatch({
            type: 'activate_event',
            event: { id: draft?.id ?? crypto.randomUUID(), source: draft?.source ?? 'manual', type, title, lat, lng, radiusKm: radius, magnitude: draft?.magnitude, depthKm: draft?.depthKm, status: 'active', time: draft?.time ?? new Date().toISOString() },
          })
          onClose()
        }}
      >
        <Select label={k.type} value={type} onChange={(e) => setType(e.target.value as DisasterType)}>
          {(Object.keys(d.disasterType) as DisasterType[]).map((t) => <option key={t} value={t}>{d.disasterType[t]}</option>)}
        </Select>
        <TextInput label={k.eventTitle} required value={title} onChange={(e) => setTitle(e.target.value)} />
        <div className="grid gap-md sm:grid-cols-2">
          <TextInput label={k.lat} type="number" step="0.0001" required value={lat} onChange={(e) => setLat(Number(e.target.value))} />
          <TextInput label={k.lng} type="number" step="0.0001" required value={lng} onChange={(e) => setLng(Number(e.target.value))} />
        </div>
        <TextInput label={k.radius} type="number" step="0.1" min={0.1} required value={radius} onChange={(e) => setRadius(Number(e.target.value))} />
        <p className="text-body-sm text-text-secondary">{k.humanInLoop}</p>
        <div className="flex flex-col gap-sm sm:flex-row-reverse">
          <Button type="submit" variant="emergency" icon={Siren}>{k.confirmActivate}</Button>
          <Button variant="secondary" onClick={onClose}>{d.common.cancel}</Button>
        </div>
      </form>
    </Dialog>
  )
}

function BmkgFeed() {
  const d = useT()
  const k = d.koord
  const { state } = useStore()
  const [draft, setDraft] = useState<DisasterEvent | undefined>()
  const feed = state.events.filter((e) => e.source === 'bmkg')
  return (
    <Panel title={k.bmkgTitle} icon={RadioTower} tone="red" bodyClass="flex flex-col gap-sm">
      <p className="text-body-sm text-text-secondary">{k.bmkgLead}</p>
      {feed.length === 0 && <p className="text-body-md text-text-secondary">{k.bmkgNone}</p>}
      <ul className="flex flex-col gap-sm">
        {feed.map((e) => (
          <li key={e.id} className="rounded-md border border-border bg-surface p-md">
            <p className="text-body-md font-semibold">{e.title}</p>
            <p className="text-body-sm text-text-secondary">{k.depth(e.depthKm ?? 0, formatTime(e.time))}</p>
            <p className="mt-xs text-caption uppercase text-text-secondary">{e.status === 'draft' ? k.draft : e.status === 'active' ? k.active : k.closedEvt}</p>
            {e.status === 'draft' && <Button block variant="secondary" className="mt-sm" onClick={() => setDraft(e)}>{k.review}</Button>}
          </li>
        ))}
      </ul>
      {draft && <ActivateDialog key={draft.id} open onClose={() => setDraft(undefined)} draft={draft} />}
    </Panel>
  )
}

const progressParts: { key: Family['status']; cls: string; label: (d: Dict) => string }[] = [
  { key: 'arrived', cls: 'bg-status-arrived', label: (d) => d.koord.kpi.arrived },
  { key: 'in_transit', cls: 'bg-status-in-transit', label: (d) => d.koord.kpi.transit },
  { key: 'confirmed', cls: 'bg-primary', label: (d) => d.koord.kpi.confirmed },
  { key: 'recommended', cls: 'bg-status-recommended', label: (d) => d.koord.kpi.recommended },
  { key: 'waiting_match', cls: 'bg-status-unverified', label: (d) => d.koord.waitingShort },
]

/** Stacked bar of where every family in the zone stands; the legend carries the numbers as text. */
function Progress({ families }: { families: Family[] }) {
  const d = useT()
  const total = families.length
  const arrived = families.filter((f) => f.status === 'arrived').length
  return (
    <Panel title={d.koord.progressTitle} icon={BarChart3} tone="green" bodyClass="flex flex-col gap-sm">
      <p className="text-h2 tabular-nums text-text-primary">{d.koord.progress(arrived, total)}</p>
      <div aria-hidden className="flex h-4 overflow-hidden rounded-full bg-surface-subtle ring-1 ring-inset ring-border">
        {progressParts.map((p) => {
          const n = families.filter((f) => f.status === p.key).length
          return n ? <div key={p.key} className={p.cls} style={{ width: `${(n / total) * 100}%` }} /> : null
        })}
      </div>
      <ul className="grid grid-cols-2 gap-x-md gap-y-xs text-body-sm text-text-secondary">
        {progressParts.map((p) => (
          <li key={p.key} className="flex items-center gap-xs"><span aria-hidden className={`h-3 w-3 rounded-full ${p.cls}`} />{p.label(d)}: <strong className="text-text-primary">{families.filter((f) => f.status === p.key).length}</strong></li>
        ))}
      </ul>
    </Panel>
  )
}

export function KoordinatorKomando() {
  const d = useT()
  const k = d.koord
  const { state, dispatch } = useStore()
  const event = activeEvent(state)
  const [activating, setActivating] = useState(false)
  const [closing, setClosing] = useState(false)
  const inZone = event ? state.families.filter((f) => distanceKm(f, event) <= event.radiusKm) : []
  const count = (st: string) => inZone.filter((f) => f.status === st).length
  const backlog = state.unmet.filter((u) => u.resolutionStatus !== 'resolved').length
  const byId = new Map(state.families.map((f) => [f.id, f]))
  const kpis: { icon: LucideIcon; tone: Tone; label: string; value: number; danger?: boolean }[] = [
    { icon: Hourglass, tone: 'orange', label: k.kpi.waiting, value: count('waiting_match') },
    { icon: Clock3, tone: 'amber', label: k.kpi.recommended, value: count('recommended') },
    { icon: ShieldCheck, tone: 'blue', label: k.kpi.confirmed, value: count('confirmed') },
    { icon: Truck, tone: 'indigo', label: k.kpi.transit, value: count('in_transit') },
    { icon: CircleCheckBig, tone: 'green', label: k.kpi.arrived, value: count('arrived') },
    { icon: AlertOctagon, tone: 'red', label: k.kpi.backlog, value: backlog, danger: backlog > 0 },
  ]

  return (
    <>
      <PageHeader
        eyebrow={event ? k.eyebrowActive(d.disasterType[event.type], fmtNum(event.radiusKm, 1)) : k.eyebrowIdle}
        title={k.title}
        description={event ? `${event.title} · ${k.lead(inZone.length)}` : k.leadIdle}
        actions={event ? (
          <Button icon={Play} onClick={() => dispatch({ type: 'run_matching' })}>{k.run}</Button>
        ) : (
          <Button variant="emergency" icon={Siren} onClick={() => setActivating(true)}>{k.activate}</Button>
        )}
      />

      <section aria-label={k.kpiLabel} className="mb-lg grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border md:grid-cols-3 xl:grid-cols-6">
        {kpis.map((x) => (
          <div key={x.label} className="flex min-w-0 flex-col gap-sm bg-background p-md">
            {/* Icon above the label on phones so long words ("Direkomendasikan") keep their full width. */}
            <div className="flex flex-col items-start gap-xs sm:flex-row sm:items-center sm:gap-sm">
              <IconChip icon={x.icon} tone={x.tone} size={32} />
              <p className="min-w-0 break-words text-body-sm font-medium text-text-secondary">{x.label}</p>
            </div>
            <p className={`text-[clamp(1.625rem,1.3rem+1.4vw,2rem)] font-bold leading-none tabular-nums ${x.danger ? 'text-status-rejected' : 'text-text-primary'}`}>{x.value}</p>
          </div>
        ))}
      </section>

      <div className="grid gap-lg xl:grid-cols-3">
        <Panel title={k.mapTitle} icon={MapIcon} className="xl:col-span-2" bodyClass="p-0">
          <MapView bare label={k.mapLabel} event={event} shelters={state.shelters} families={inZone} height="clamp(280px, 55vh, 520px)" />
          <div className="border-t border-border px-md py-sm"><MapLegend /></div>
        </Panel>

        <div className="flex min-w-0 flex-col gap-lg">
          {inZone.length > 0 && <Progress families={inZone} />}
          <Panel title={k.capacityTitle} icon={Building2} bodyClass="p-0">
            <ul className="divide-y divide-border">
              {state.shelters.map((s) => {
                const l = shelterLoad(s, state.assignments, byId)
                return (
                  <li key={s.id} className="flex flex-col gap-xs px-md py-sm">
                    <div className="flex items-start justify-between gap-sm">
                      <p className="text-body-md font-semibold">{s.name}</p>
                      <p className="whitespace-nowrap text-body-sm font-semibold tabular-nums">{k.left(l.remaining, s.totalCapacity)}</p>
                    </div>
                    <Meter value={l.occupied + l.reserved} max={s.totalCapacity} label={k.fillLabel(s.name)} />
                    <div className="flex flex-wrap gap-xs">
                      <StatusBadge status={s.verificationStatus} />
                      {s.operationalStatus !== 'open' && <span className="rounded-full bg-surface-subtle px-[10px] py-xs text-body-sm font-semibold text-text-secondary">{s.operationalStatus === 'full' ? k.full : k.closed}</span>}
                    </div>
                  </li>
                )
              })}
            </ul>
          </Panel>
        </div>

        <Panel title={k.familiesTitle} icon={Users} tone="indigo" className="xl:col-span-2" bodyClass={inZone.length ? 'p-0' : undefined}>
          {inZone.length === 0 ? (
            <EmptyState title={k.emptyTitle}>{k.emptyBody}</EmptyState>
          ) : (
            <ul className="grid divide-y divide-border md:grid-cols-2 md:divide-y-0">
              {inZone.map((f) => {
                const a = currentAssignment(state, f.id)
                const sh = a && state.shelters.find((s) => s.id === a.shelterId)
                return (
                  <li key={f.id} className="flex flex-wrap items-center justify-between gap-sm border-border px-md py-sm md:border-b md:odd:border-r">
                    <div className="min-w-0">
                      <p className="text-body-md font-semibold">{f.familyName} <span className="font-normal text-text-secondary">· {d.common.people(f.memberCount)}</span></p>
                      <p className="text-body-sm text-text-secondary">{sh && f.status !== 'waiting_match' ? sh.name : k.noShelter}</p>
                    </div>
                    <StatusBadge status={f.status} />
                  </li>
                )
              })}
            </ul>
          )}
        </Panel>

        <BmkgFeed />
      </div>

      {event && (
        <section aria-labelledby="akhiri" className="mt-2xl flex flex-col gap-sm rounded-lg border border-border bg-background p-md sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 id="akhiri" className="text-h3">{k.endTitle}</h2>
            <p className="text-body-sm text-text-secondary">{k.endBody}</p>
          </div>
          <Button variant="danger-outline" icon={Power} onClick={() => setClosing(true)}>{k.end}</Button>
        </section>
      )}

      {activating && <ActivateDialog open onClose={() => setActivating(false)} />}
      <Dialog open={closing} onClose={() => setClosing(false)} title={k.endDialog}>
        <p className="text-body-md">{k.endDialogBody}</p>
        <div className="mt-lg flex flex-col gap-sm sm:flex-row-reverse">
          <Button onClick={() => { if (event) dispatch({ type: 'close_event', id: event.id }); setClosing(false) }}>{k.endConfirm}</Button>
          <Button variant="secondary" onClick={() => setClosing(false)}>{d.common.cancel}</Button>
        </div>
      </Dialog>
    </>
  )
}

export function KoordinatorPenugasan() {
  const d = useT()
  const k = d.koord
  const { state, dispatch } = useStore()
  const [pick, setPick] = useState<Record<string, string>>({})
  // Families who said they are ready come first.
  const confirmed = state.assignments
    .filter((a) => a.status === 'confirmed')
    .sort((a, b) => Number(!!a.volunteerId) - Number(!!b.volunteerId) || Number(!!b.readyForPickupAt) - Number(!!a.readyForPickupAt))
  return (
    <>
      <PageHeader eyebrow={d.roles.coordinator} title={k.dispatchTitle} description={k.dispatchLead} />
      {confirmed.length === 0 ? (
        <EmptyState title={k.dispatchEmptyTitle}>{k.dispatchEmptyBody}</EmptyState>
      ) : (
        <ul className="grid gap-md lg:grid-cols-2">
          {confirmed.map((a) => {
            const f = state.families.find((x) => x.id === a.familyId)!
            const sh = state.shelters.find((s) => s.id === a.shelterId)!
            const assigned = state.volunteers.find((v) => v.id === a.volunteerId)
            const chosen = pick[a.id] ?? state.volunteers.find((v) => vehicleFits(f, v.vehicleType))?.id ?? ''
            const chosenFits = !!chosen && vehicleFits(f, state.volunteers.find((v) => v.id === chosen)!.vehicleType)
            return (
              <Card as="li" key={a.id} className="flex flex-col gap-md">
                <div className="flex flex-wrap items-start justify-between gap-sm">
                  <div>
                    <h2 className="text-h3">{f.familyName}</h2>
                    <p className="text-body-sm text-text-secondary">{k.toShelter(f.memberCount, sh.name)}</p>
                  </div>
                  <StatusBadge status="confirmed" />
                </div>
                <NeedBadges family={f} />
                <p className={`text-body-sm font-semibold ${a.readyForPickupAt ? 'text-status-arrived' : 'text-text-secondary'}`}>{a.readyForPickupAt ? k.readySince(formatTime(a.readyForPickupAt)) : k.notReady}</p>
                {assigned ? (
                  <p className="mt-auto flex items-center gap-sm rounded-md bg-tint-confirmed px-md py-sm text-body-md font-semibold text-status-confirmed">
                    <UserCheck aria-hidden className="h-5 w-5" />{k.assigned(assigned.name, d.vehicle[assigned.vehicleType], assigned.plate)}
                  </p>
                ) : (
                  <div className="mt-auto grid gap-sm sm:grid-cols-[1fr_auto] sm:items-end">
                    <Select label={k.volunteer} value={chosen} onChange={(e) => setPick({ ...pick, [a.id]: e.target.value })}>
                      {state.volunteers.map((v) => {
                        const fits = vehicleFits(f, v.vehicleType)
                        return <option key={v.id} value={v.id} disabled={!fits}>{v.name} — {d.vehicle[v.vehicleType]}{fits ? '' : ` ${k.unfit}`}</option>
                      })}
                    </Select>
                    <Button icon={UserCheck} disabled={!chosenFits} onClick={() => dispatch({ type: 'dispatch', id: a.id, volunteerId: chosen })}>{k.assign}</Button>
                  </div>
                )}
              </Card>
            )
          })}
        </ul>
      )}
    </>
  )
}

function unmetText(u: UnmetNeed, d: Dict): string {
  return u.detail ? d.unmet(u.detail) : u.description ?? ''
}

function toCsv(rows: UnmetNeed[], d: Dict, name: (id: string) => string, people: (id: string) => number): string {
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`
  return [d.koord.csvHead, ...rows.map((u) => [name(u.familyId), people(u.familyId), d.facility[u.missingFacilityType], unmetText(u, d), d.severity[u.severity], d.resolution[u.resolutionStatus], u.reportedAt])]
    .map((r) => r.map(esc).join(','))
    .join('\n')
}

export function KoordinatorBacklog() {
  const d = useT()
  const k = d.koord
  const { state, dispatch } = useStore()
  const open = state.unmet.filter((u) => u.resolutionStatus !== 'resolved')
  const fam = (id: string) => state.families.find((f) => f.id === id)
  const summary = Object.entries(
    open.reduce<Record<string, { families: number; people: number }>>((acc, u) => {
      const key = u.missingFacilityType
      acc[key] ??= { families: 0, people: 0 }
      acc[key].families += 1
      acc[key].people += fam(u.familyId)?.memberCount ?? 0
      return acc
    }, {}),
  ) as [UnmetNeed['missingFacilityType'], { families: number; people: number }][]
  const exportCsv = () => {
    const blob = new Blob(['﻿' + toCsv(open, d, (id) => fam(id)?.familyName ?? id, (id) => fam(id)?.memberCount ?? 0)], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `evacfit-backlog-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }
  return (
    <>
      <PageHeader
        eyebrow={d.roles.coordinator}
        title={k.backlogTitle}
        description={k.backlogLead}
        actions={
          <>
            <Button icon={RefreshCw} onClick={() => dispatch({ type: 'run_matching' })} disabled={!activeEvent(state)}>{k.rerun}</Button>
            <Button variant="secondary" icon={Download} onClick={exportCsv} disabled={!open.length}>{k.csv}</Button>
            <Button variant="secondary" icon={Printer} onClick={() => window.print()} disabled={!open.length}>{k.print}</Button>
          </>
        }
      />
      {open.length === 0 ? (
        <EmptyState title={k.backlogEmptyTitle}>{k.backlogEmptyBody}</EmptyState>
      ) : (
        <>
          <ul className="mb-xl grid gap-md sm:grid-cols-2 xl:grid-cols-4" aria-label={k.deficit}>
            {summary.map(([key, v]) => (
              <li key={key} className="rounded-lg border-l-4 border-status-rejected bg-tint-rejected p-md">
                <p className="text-body-sm font-semibold text-status-rejected">{d.facility[key]}</p>
                <p className="text-h2 text-status-rejected">{k.places(v.people)}</p>
                <p className="text-body-sm text-text-primary">{k.forFamilies(v.families)}</p>
              </li>
            ))}
          </ul>
          <div className="relative overflow-x-auto rounded-lg border border-border bg-background">
            <table className="w-full min-w-[720px] text-left text-body-md">
              <caption className="sr-only">{k.backlogCaption}</caption>
              <thead className="bg-surface-subtle text-body-sm text-text-secondary">
                <tr>
                  <th scope="col" className="p-sm">{k.col.family}</th>
                  <th scope="col" className="p-sm">{k.col.missing}</th>
                  <th scope="col" className="p-sm">{k.col.detail}</th>
                  <th scope="col" className="p-sm">{k.col.severity}</th>
                  <th scope="col" className="p-sm">{k.col.followUp}</th>
                </tr>
              </thead>
              <tbody>
                {open.map((u) => {
                  const f = fam(u.familyId)
                  const sh = u.shelterId && state.shelters.find((s) => s.id === u.shelterId)
                  return (
                    <tr key={u.id} className="border-t border-border align-top">
                      <th scope="row" className="p-sm font-semibold">{f?.familyName}<span className="block text-body-sm font-normal text-text-secondary">{d.common.people(f?.memberCount ?? 0)} · {sh ? k.reportedBy(sh.name) : k.fromMatching}</span></th>
                      <td className="p-sm">{d.facility[u.missingFacilityType]}</td>
                      <td className="p-sm">{unmetText(u, d)}</td>
                      <td className="p-sm"><SeverityBadge s={u.severity} /></td>
                      <td className="p-sm">
                        <label className="sr-only" htmlFor={`st-${u.id}`}>{k.statusFor(f?.familyName ?? '')}</label>
                        <select id={`st-${u.id}`} className="min-h-12 rounded-md border border-text-muted bg-background px-sm" value={u.resolutionStatus} onChange={(e) => dispatch({ type: 'resolve_unmet', id: u.id, status: e.target.value as UnmetNeed['resolutionStatus'] })}>
                          {(['open', 'in_progress', 'resolved'] as const).map((r) => <option key={r} value={r}>{d.resolution[r]}</option>)}
                        </select>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  )
}

export function KoordinatorPosko() {
  const d = useT()
  const k = d.koord
  const { state, dispatch } = useStore()
  return (
    <>
      <PageHeader eyebrow={d.roles.coordinator} title={k.verifyTitle} description={k.verifyLead} />
      <ul className="grid gap-md lg:grid-cols-2">
        {state.shelters.map((s) => (
          <li key={s.id}>
            <ShelterCard shelter={s} headingLevel={2}>
              {s.verificationStatus === 'verified' ? (
                <Button block variant="secondary" icon={ShieldOff} onClick={() => dispatch({ type: 'verify_shelter', id: s.id, verified: false })}>{k.unverify}</Button>
              ) : (
                <Button block icon={ShieldCheck} onClick={() => dispatch({ type: 'verify_shelter', id: s.id, verified: true })}>{k.verify}</Button>
              )}
            </ShelterCard>
          </li>
        ))}
      </ul>
    </>
  )
}
