import { Accessibility, Building2, Check, Languages as LanguagesIcon, LogIn, MapPin, Save, ShieldAlert, X } from 'lucide-react'
import { useId, useState } from 'react'
import { NeedBadges, usePersona } from '../components/domain'
import { LocationPicker } from '../components/LocationPicker'
import { Button, Card, CheckRow, Dialog, EmptyState, Justification, Meter, PageHeader, Panel, Select, StatusBadge, TextArea, TextInput } from '../components/ui'
import { useT } from '../i18n'
import { formatKm, formatTime } from '../lib/geo'
import { facilityTypes, shelterLoad } from '../lib/matching'
import { useRegion, useStore } from '../state/store'
import type { Assignment, FacilityType, RejectionCode, Severity, Shelter, ShelterOperationalStatus } from '../types'

function useShelter() {
  const { state } = useStore()
  const [id] = usePersona('shelter')
  return state.shelters.find((s) => s.id === id) ?? state.shelters[0]
}

/** One compact card: how full I am and my operational status (a rare change, so a select rather than a hero control). */
function ShelterSummary({ shelter }: { shelter: Shelter }) {
  const d = useT()
  const { state, dispatch } = useStore()
  const [pending, setPending] = useState(false)
  const load = shelterLoad(shelter, state.assignments, new Map(state.families.map((f) => [f.id, f])))
  const fid = useId()
  const choose = (v: ShelterOperationalStatus) => (v === 'closed_emergency' ? setPending(true) : dispatch({ type: 'set_shelter_status', id: shelter.id, status: v }))
  const statusBorder = shelter.operationalStatus === 'open' ? 'border-status-arrived' : shelter.operationalStatus === 'full' ? 'border-status-recommended' : 'border-status-rejected'
  return (
    <Card className="mb-lg">
      <div className="flex flex-col gap-md lg:flex-row lg:items-center lg:gap-xl">
        <div className="min-w-0 flex-1">
          <div className="mb-sm flex flex-wrap items-center gap-sm">
            <h2 className="text-h3">{shelter.name}</h2>
            <StatusBadge status={shelter.verificationStatus} />
          </div>
          <Meter value={load.occupied + load.reserved} max={shelter.totalCapacity} label={d.posko.fill} />
          <dl className="mt-sm flex flex-wrap gap-x-lg gap-y-xs text-body-md">
            <div className="flex gap-xs"><dt className="text-text-secondary">{d.posko.filled}</dt><dd className="font-semibold tabular-nums">{load.occupied}</dd></div>
            <div className="flex gap-xs"><dt className="text-text-secondary">{d.posko.booked}</dt><dd className="font-semibold tabular-nums">{load.reserved}</dd></div>
            <div className="flex gap-xs"><dt className="text-text-secondary">{d.posko.left}</dt><dd className={load.remaining === 0 ? 'font-bold tabular-nums text-status-rejected' : 'font-bold tabular-nums text-status-arrived'}>{d.shelterCard.of(load.remaining, shelter.totalCapacity)}</dd></div>
          </dl>
        </div>
        <div className="flex flex-col gap-xs lg:w-[300px]">
          <label htmlFor={fid} className="text-body-sm font-semibold text-text-secondary">{d.posko.status}</label>
          <select id={fid} value={shelter.operationalStatus} onChange={(e) => choose(e.target.value as ShelterOperationalStatus)} className={'min-h-12 rounded-md border-2 bg-background px-sm text-body-md font-semibold ' + statusBorder}>
            {(['open', 'full', 'closed_emergency'] as ShelterOperationalStatus[]).map((o) => <option key={o} value={o}>{d.opStatus[o]}</option>)}
          </select>
        </div>
      </div>
      <Dialog open={pending} onClose={() => setPending(false)} title={d.posko.closeTitle}>
        <p className="text-body-md">{d.posko.closeBody}</p>
        <div className="mt-lg flex flex-col gap-sm sm:flex-row-reverse">
          <Button variant="emergency" onClick={() => { dispatch({ type: 'set_shelter_status', id: shelter.id, status: 'closed_emergency' }); setPending(false) }}>{d.posko.closeConfirm}</Button>
          <Button variant="secondary" onClick={() => setPending(false)}>{d.common.cancel}</Button>
        </div>
      </Dialog>
    </Card>
  )
}

function RejectDialog({ assignment, onClose }: { assignment: Assignment | null; onClose: () => void }) {
  const d = useT()
  const { dispatch } = useStore()
  const [code, setCode] = useState<RejectionCode>('facility_power_down')
  const [note, setNote] = useState('')
  const name = useId()
  return (
    <Dialog open={assignment !== null} onClose={onClose} title={d.posko.rejectTitle}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (!assignment) return
          dispatch({ type: 'reject', id: assignment.id, code, note })
          setNote('')
          onClose()
        }}
        className="flex flex-col gap-md"
      >
        <fieldset>
          <legend className="mb-sm text-body-md font-semibold">{d.posko.reasonLegend}</legend>
          <div className="flex flex-col gap-sm">
            {(Object.keys(d.rejection) as RejectionCode[]).map((c) => (
              <label key={c} className="flex min-h-12 cursor-pointer items-center gap-sm rounded-md border border-text-muted px-md">
                <input type="radio" name={name} className="h-6 w-6 accent-primary" checked={code === c} onChange={() => setCode(c)} />
                <span className="text-body-md">{d.rejection[c]}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <TextArea label={d.posko.note} required={code === 'other'} helper={code === 'other' ? d.posko.noteRequired : d.posko.optional} value={note} onChange={(e) => setNote(e.target.value)} />
        <p className="text-body-sm text-text-secondary">{d.posko.rejectInfo}</p>
        <div className="flex flex-col gap-sm sm:flex-row-reverse">
          <Button type="submit" variant="emergency" icon={X}>{d.posko.rejectConfirm}</Button>
          <Button variant="secondary" onClick={onClose}>{d.common.cancel}</Button>
        </div>
      </form>
    </Dialog>
  )
}

export function PoskoRekomendasi() {
  const d = useT()
  const { state, dispatch } = useStore()
  const shelter = useShelter()
  const [rejecting, setRejecting] = useState<Assignment | null>(null)
  // Reallocated families first (they already lost a place once), then the soonest soft-lock deadline.
  const incoming = state.assignments
    .filter((a) => a.shelterId === shelter.id && a.status === 'recommended')
    .sort((a, b) => Number(!!b.reallocatedFromId) - Number(!!a.reallocatedFromId) || a.softLockExpiresAt.localeCompare(b.softLockExpiresAt))
  const confirmed = state.assignments.filter((a) => a.shelterId === shelter.id && a.status === 'confirmed').length
  return (
    <>
      <PageHeader eyebrow={d.roles.shelter} title={d.posko.incomingTitle} description={d.posko.incomingLead} />
      <ShelterSummary shelter={shelter} />
      <h2 className="mb-md text-h2">{d.posko.waiting(incoming.length)}</h2>
      {incoming.length === 0 ? (
        <EmptyState title={d.posko.emptyTitle}>{confirmed > 0 ? d.posko.emptyConfirmed(confirmed) : d.posko.emptyBody}</EmptyState>
      ) : (
        <ul className="grid gap-md xl:grid-cols-2">
          {incoming.map((a) => {
            const f = state.families.find((x) => x.id === a.familyId)!
            return (
              <Card as="li" key={a.id} className={`flex flex-col gap-md ${a.reallocatedFromId ? 'border-l-4 border-l-status-unverified' : ''}`}>
                <div className="flex flex-wrap items-start justify-between gap-sm">
                  <div>
                    <h3 className="text-h3">{f.familyName}</h3>
                    <p className="text-body-sm text-text-secondary">{d.common.people(f.memberCount)} · {formatKm(a.distanceKm)} · <span className="font-mono">{f.code}</span></p>
                  </div>
                  <StatusBadge status="recommended" />
                </div>
                {a.reallocatedFromId && (
                  <p className="flex items-center gap-sm rounded-md bg-tint-unverified px-md py-sm text-body-sm font-semibold text-status-unverified">
                    <ShieldAlert aria-hidden className="h-4 w-4" />{d.posko.priority}
                  </p>
                )}
                <NeedBadges family={f} />
                <Justification>{d.reason(a.reason, shelter.name)}</Justification>
                <p className="text-body-sm text-text-secondary">{d.posko.lockUntil(formatTime(a.softLockExpiresAt))}</p>
                {/* Primary action first and widest; reject is secondary and set apart by colour. */}
                <div className="mt-auto grid gap-sm sm:grid-cols-[2fr_1fr]">
                  <Button block icon={Check} onClick={() => dispatch({ type: 'confirm', id: a.id })}>{d.posko.confirm}</Button>
                  <Button block variant="danger-outline" icon={X} onClick={() => setRejecting(a)}>{d.posko.reject}</Button>
                </div>
              </Card>
            )
          })}
        </ul>
      )}
      <RejectDialog assignment={rejecting} onClose={() => setRejecting(null)} />
    </>
  )
}

function CheckInDialog({ assignment, onClose }: { assignment: Assignment | null; onClose: () => void }) {
  const d = useT()
  const { dispatch } = useStore()
  const [hasGap, setHasGap] = useState(false)
  const [type, setType] = useState<FacilityType>('accessible_toilet')
  const [description, setDescription] = useState('')
  const [severity, setSeverity] = useState<Severity>('medium')
  return (
    <Dialog open={assignment !== null} onClose={onClose} title={d.posko.checkinTitle}>
      <form
        className="flex flex-col gap-md"
        onSubmit={(e) => {
          e.preventDefault()
          if (!assignment) return
          dispatch({ type: 'check_in', id: assignment.id, unmet: hasGap ? { type, description, severity } : undefined })
          setHasGap(false)
          setDescription('')
          onClose()
        }}
      >
        <p className="text-body-md">{d.posko.checkinHint}</p>
        <CheckRow label={d.posko.gap} description={d.posko.gapHint} checked={hasGap} onChange={setHasGap} />
        {hasGap && (
          <>
            <Select label={d.posko.gapType} value={type} onChange={(e) => setType(e.target.value as FacilityType)}>
              {facilityTypes.map((k) => <option key={k} value={k}>{d.facility[k]}</option>)}
            </Select>
            <TextArea label={d.posko.gapDetail} required value={description} onChange={(e) => setDescription(e.target.value)} />
            <Select label={d.posko.gapSeverity} value={severity} onChange={(e) => setSeverity(e.target.value as Severity)}>
              {(Object.keys(d.severity) as Severity[]).map((s) => <option key={s} value={s}>{d.severity[s]}</option>)}
            </Select>
          </>
        )}
        <div className="flex flex-col gap-sm sm:flex-row-reverse">
          <Button type="submit" icon={LogIn}>{d.posko.checkin}</Button>
          <Button variant="secondary" onClick={onClose}>{d.common.cancel}</Button>
        </div>
      </form>
    </Dialog>
  )
}

export function PoskoKedatangan() {
  const d = useT()
  const { state } = useStore()
  const shelter = useShelter()
  const [q, setQ] = useState('')
  const [checking, setChecking] = useState<Assignment | null>(null)
  const mine = state.assignments.filter((a) => a.shelterId === shelter.id)
  const match = (a: Assignment) => {
    const f = state.families.find((x) => x.id === a.familyId)!
    const t = q.trim().toLowerCase()
    return !t || f.code.toLowerCase().includes(t) || f.familyName.toLowerCase().includes(t)
  }
  const groups: ('in_transit' | 'confirmed' | 'arrived')[] = ['in_transit', 'confirmed', 'arrived']
  return (
    <>
      <PageHeader
        eyebrow={d.roles.shelter}
        title={d.posko.arrivalsTitle}
        description={d.posko.arrivalsLead(shelter.name)}
        actions={<div className="w-full md:w-[320px]"><TextInput label={d.posko.search} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="EVF-01KE" /></div>}
      />
      <div className="flex flex-col gap-lg">
        {groups.map((g) => {
          const list = mine.filter((a) => a.status === g && match(a))
          return (
            <Panel key={g} title={d.posko.count(d.posko.groups[g], list.length)} icon={g === 'in_transit' ? LogIn : g === 'confirmed' ? Check : Building2} tone={g === 'in_transit' ? 'indigo' : g === 'confirmed' ? 'blue' : 'green'}>
              {list.length === 0 ? (
                <p className="text-body-md text-text-secondary">{d.common.none}</p>
              ) : (
                <ul className="grid gap-md lg:grid-cols-2">
                  {list.map((a) => {
                    const f = state.families.find((x) => x.id === a.familyId)!
                    const vol = state.volunteers.find((v) => v.id === a.volunteerId)
                    return (
                      <li key={a.id} className="flex flex-col gap-sm rounded-lg border border-border bg-surface p-md">
                        <div className="flex flex-wrap items-start justify-between gap-sm">
                          <div>
                            <h3 className="text-h3">{f.familyName}</h3>
                            <p className="text-body-sm text-text-secondary">{d.common.people(f.memberCount)} · <span className="font-mono font-semibold text-text-primary">{f.code}</span></p>
                          </div>
                          <StatusBadge status={a.status} />
                        </div>
                        <NeedBadges family={f} />
                        {vol && <p className="text-body-sm text-text-secondary">{d.posko.deliveredBy(vol.name, d.vehicle[vol.vehicleType], vol.plate)}</p>}
                        {a.status === 'in_transit' && <Button block icon={LogIn} onClick={() => setChecking(a)}>{d.posko.checkin}</Button>}
                        {a.status === 'arrived' && a.arrivedAt && <p className="text-body-sm text-text-secondary">{d.posko.arrivedAt(formatTime(a.arrivedAt))}</p>}
                      </li>
                    )
                  })}
                </ul>
              )}
            </Panel>
          )
        })}
      </div>
      <CheckInDialog assignment={checking} onClose={() => setChecking(null)} />
    </>
  )
}

export function PoskoFasilitas() {
  const d = useT()
  const { dispatch } = useStore()
  const shelter = useShelter()
  return (
    <>
      <PageHeader eyebrow={d.roles.shelter} title={d.posko.facilitiesTitle} description={d.posko.facilitiesLead(shelter.name)} />
      <ShelterForm key={shelter.id} shelter={shelter} onSave={(s) => dispatch({ type: 'save_shelter', shelter: s })} />
    </>
  )
}

function ShelterForm({ shelter, onSave }: { shelter: Shelter; onSave: (s: Shelter) => void }) {
  const d = useT()
  const p = d.posko
  const { serviceLanguages } = useRegion()
  const [s, setS] = useState(shelter)
  const [msg, setMsg] = useState<'' | 'saved' | 'savedReverify'>('')
  const f = s.features
  const setF = <K extends keyof Shelter['features']>(k: K, v: Shelter['features'][K]) => setS({ ...s, features: { ...f, [k]: v } })
  return (
    <form
      className="grid max-w-[1080px] gap-lg lg:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault()
        // SHLT-3: changed accessibility claims go back to "Needs Inspection" until re-inspected.
        const changed = JSON.stringify(s.features) !== JSON.stringify(shelter.features) || s.lat !== shelter.lat || s.lng !== shelter.lng
        // Status fields are owned elsewhere (status select, coordinator verification); never overwrite them from this form.
        const next: Shelter = { ...s, operationalStatus: shelter.operationalStatus, verificationStatus: changed ? 'unverified' : shelter.verificationStatus }
        onSave(next)
        setMsg(changed && shelter.verificationStatus === 'verified' ? 'savedReverify' : 'saved')
      }}
    >
      <Panel title={p.identity} icon={Building2} actions={<StatusBadge status={shelter.verificationStatus} />} bodyClass="flex flex-col gap-md">
        <TextInput label={p.name} required value={s.name} onChange={(e) => setS({ ...s, name: e.target.value })} />
        <TextArea label={p.address} required value={s.address} onChange={(e) => setS({ ...s, address: e.target.value })} />
        <TextInput label={p.contact} type="tel" value={s.contact} onChange={(e) => setS({ ...s, contact: e.target.value })} />
        <div className="grid gap-md sm:grid-cols-2">
          <TextInput label={p.capacity} type="number" min={0} required value={s.totalCapacity} onChange={(e) => setS({ ...s, totalCapacity: Math.max(0, Number(e.target.value)) })} />
          <TextInput label={p.local} helper={p.localHint} type="number" min={0} value={s.currentOccupancy} onChange={(e) => setS({ ...s, currentOccupancy: Math.max(0, Number(e.target.value)) })} />
        </div>
      </Panel>
      <Panel title={p.location} icon={MapPin} className="lg:col-span-2" bodyClass="flex flex-col gap-md">
        <p className="text-body-sm text-text-secondary">{p.locationHint}</p>
        <LocationPicker value={s} onChange={(pt) => setS({ ...s, ...pt })} />
      </Panel>
      <Panel title={p.access} icon={Accessibility} tone="green" bodyClass="flex flex-col gap-sm">
        <CheckRow label={p.f.ramp} checked={f.hasRamp} onChange={(v) => setF('hasRamp', v)} />
        <CheckRow label={p.f.slope} checked={f.rampSlopeCompliant} onChange={(v) => setF('rampSlopeCompliant', v)} />
        <CheckRow label={p.f.door} checked={f.doorWidthAccessible} onChange={(v) => setF('doorWidthAccessible', v)} />
        <CheckRow label={p.f.toilet} checked={f.hasAccessibleToilet} onChange={(v) => setF('hasAccessibleToilet', v)} />
        {f.hasAccessibleToilet && <TextInput label={p.f.toiletCount} type="number" min={0} value={f.accessibleToiletCount} onChange={(e) => setF('accessibleToiletCount', Math.max(0, Number(e.target.value)))} />}
        <CheckRow label={p.f.power} checked={f.hasMedicalPower} onChange={(v) => setF('hasMedicalPower', v)} />
        {f.hasMedicalPower && <TextInput label={p.f.powerW} type="number" min={0} step={100} value={f.backupGeneratorCapacityWatt} onChange={(e) => setF('backupGeneratorCapacityWatt', Math.max(0, Number(e.target.value)))} />}
        <CheckRow label={p.f.caregiver} checked={f.hasCaregiverRooms} onChange={(v) => setF('hasCaregiverRooms', v)} />
      </Panel>
      <Panel title={p.languages} icon={LanguagesIcon} tone="indigo" className="lg:col-span-2">
        <div className="grid gap-sm sm:grid-cols-2 lg:grid-cols-4">
          {serviceLanguages.map((l) => (
            <CheckRow key={l} label={d.serviceLang(l)} checked={f.supportedLanguages.includes(l)} onChange={(v) => setF('supportedLanguages', v ? [...f.supportedLanguages, l] : f.supportedLanguages.filter((x) => x !== l))} />
          ))}
        </div>
      </Panel>
      <div className="flex flex-col gap-sm lg:col-span-2 lg:flex-row lg:items-center">
        <Button type="submit" icon={Save} className="lg:min-w-[280px]">{p.saveShelter}</Button>
        <p role="status" className="text-body-md font-semibold text-status-arrived">{msg && p[msg]}</p>
      </div>
    </form>
  )
}
