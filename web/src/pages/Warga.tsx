// Citizen screens. Design rules: one big status + one big action per screen, one question per step,
// 18px text, 60px controls, icon + text everywhere, plain language, read-aloud on key messages.
import {
  Accessibility, ArrowLeft, ArrowRight, Backpack, Baby, Bus, Check, CircleCheckBig, Clock3, HeartHandshake, Hourglass, House,
  IdCard, Languages, LocateFixed, MapPin, Navigation, Pencil, Phone, PlugZap, Save, ShieldCheck, Toilet, Truck, UserPlus, Users,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { usePersona } from '../components/domain'
import { useLocate } from '../components/FamilyForm'
import {
  Button, ChoiceTile, Counter, FeatureBadge, IconChip, Justification, Meter, ReadAloud, StatusBadge, TextArea, TextInput, buttonCls, toneCls, type Tone,
} from '../components/ui'
import { region } from '../config'
import { citizenFamilyIds, emptyNeeds } from '../data/mock'
import { dataMode } from '../state/remote'
import { useT, type Dict } from '../i18n'
import { distanceKm, formatKm, formatTime } from '../lib/geo'
import { needKeys } from '../lib/needs'
import { activeEvent, currentAssignment, useStore, type State } from '../state/store'
import type { Assignment, Family, FunctionalNeeds, NeedKey, Shelter } from '../types'

const needIcon: Record<NeedKey, LucideIcon> = {
  noStairsRequired: Accessibility,
  accessibleToiletNeeded: Toilet,
  caregiverSpaceNeeded: HeartHandshake,
  medicalPowerRequired: PlugZap,
  wheelchairVehicleNeeded: Bus,
}

function myFamilies(s: State): Family[] {
  // Supabase: RLS already returns only this account's families.
  return dataMode === 'supabase' ? s.families : s.families.filter((f) => citizenFamilyIds.includes(f.id) || f.registeredVia === 'caregiver')
}

function useMyFamily() {
  const { state } = useStore()
  const [famId, setFamId] = usePersona('family')
  const list = myFamilies(state)
  const fam = list.find((f) => f.id === famId) ?? list[0]
  return { fam, list, setFamId }
}

/* ---------- Home (status) ---------- */

interface Hero {
  tone: Tone
  icon: LucideIcon
  title: string
  body: string
  action?: ReactNode
}

function heroFor(d: Dict, s: State, fam: Family, a: Assignment | undefined, onReady: () => void): Hero {
  const h = d.warga.hero
  const event = activeEvent(s)
  const shelterName = (a && s.shelters.find((x) => x.id === a.shelterId)?.name) ?? h.fallbackShelter
  const vol = a?.volunteerId ? s.volunteers.find((v) => v.id === a.volunteerId) : undefined
  const unmet = s.unmet.some((u) => u.familyId === fam.id && u.resolutionStatus !== 'resolved' && !u.shelterId)
  switch (fam.status) {
    case 'waiting_match':
      return unmet ? { tone: 'orange', icon: Hourglass, title: h.unmetTitle, body: h.unmetBody } : { tone: 'amber', icon: Hourglass, title: h.waitingTitle, body: h.waitingBody }
    case 'recommended':
      return { tone: 'amber', icon: Clock3, title: h.recommendedTitle, body: h.recommendedBody(shelterName) }
    case 'confirmed':
      if (a?.readyForPickupAt) {
        return vol
          ? { tone: 'blue', icon: Truck, title: h.pickupTitle, body: h.pickupBody(vol.name, d.vehicle[vol.vehicleType], vol.plate) }
          : { tone: 'blue', icon: Truck, title: h.waitPickupTitle, body: h.waitPickupBody }
      }
      return {
        tone: 'blue', icon: ShieldCheck, title: h.readyTitle, body: h.readyBody(shelterName, fam.memberCount),
        action: <Button size="lg" block icon={Check} onClick={onReady}>{h.readyAction}</Button>,
      }
    case 'in_transit':
      return { tone: 'indigo', icon: Truck, title: h.transitTitle, body: h.transitBody(shelterName) }
    case 'arrived':
      return { tone: 'green', icon: CircleCheckBig, title: h.arrivedTitle, body: h.arrivedBody(shelterName) }
    default:
      return event ? { tone: 'neutral', icon: House, title: h.outsideTitle, body: h.outsideBody } : { tone: 'neutral', icon: House, title: h.idleTitle, body: h.idleBody }
  }
}

const journeyAt: ((a: Assignment) => string | undefined)[] = [(a) => a.createdAt, (a) => a.confirmedAt, (a) => a.departedAt, (a) => a.arrivedAt]
const journeyKeys: Assignment['status'][] = ['recommended', 'confirmed', 'in_transit', 'arrived']

/** Vertical timeline: easier to read than a 4-column stepper on a phone. */
function Journey({ a }: { a: Assignment }) {
  const d = useT()
  const idx = journeyKeys.indexOf(a.status)
  return (
    <ol aria-label={d.warga.journeyTitle} className="flex flex-col">
      {d.warga.journey.map((label, i) => {
        const done = i <= idx
        const now = i === idx
        const t = journeyAt[i](a)
        return (
          <li key={label} aria-current={now ? 'step' : undefined} className="relative flex gap-md pb-md last:pb-0">
            {i < journeyKeys.length - 1 && <span aria-hidden className={`absolute left-[19px] top-10 h-[calc(100%-32px)] w-0.5 ${i < idx ? 'bg-primary' : 'bg-border'}`} />}
            <span className={`relative z-10 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 text-body-md font-bold ${done ? 'border-primary bg-primary text-text-on-primary' : 'border-text-muted bg-background text-text-secondary'}`}>
              {done ? <Check aria-hidden className="h-5 w-5" strokeWidth={3} /> : i + 1}
            </span>
            <div className="pt-1.5">
              <p className={`text-body-lg ${done ? 'font-semibold text-text-primary' : 'text-text-secondary'}`}>
                {label}
                {now && <span className="ml-sm rounded-full bg-tint-confirmed px-sm py-0.5 text-body-sm font-semibold text-status-confirmed">{d.warga.now}</span>}
                {done && <span className="sr-only"> {d.warga.done}</span>}
              </p>
              {done && t && <p className="text-body-sm text-text-secondary">{d.common.at(formatTime(t))}</p>}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

function Destination({ shelter, a }: { shelter: Shelter; a: Assignment }) {
  const d = useT()
  const confirmed = ['confirmed', 'in_transit', 'arrived'].includes(a.status)
  const f = shelter.features
  const chips = [
    f.hasRamp && f.rampSlopeCompliant && d.features.noStairs,
    f.hasAccessibleToilet && d.features.accessibleToilet,
    f.hasMedicalPower && d.features.medicalPower,
    f.hasCaregiverRooms && d.features.caregiverRoom,
  ].filter(Boolean) as string[]
  return (
    <section aria-labelledby="tujuan" className="rounded-lg border border-border bg-background p-5">
      <p className="text-caption uppercase text-text-secondary">{d.warga.destination}</p>
      <h2 id="tujuan" className="mt-xs text-h3">{shelter.name}</h2>
      <p className="mt-xs flex items-start gap-xs text-body-md text-text-secondary"><MapPin aria-hidden className="mt-1 h-4 w-4 shrink-0" />{shelter.address} · {d.common.km(formatKm(a.distanceKm))}</p>
      {chips.length > 0 && (
        <ul className="mt-md flex flex-wrap gap-xs" aria-label={d.shelterCard.features}>{chips.map((c) => <li key={c}><FeatureBadge>{c}</FeatureBadge></li>)}</ul>
      )}
      <details className="mt-md">
        <summary className="inline-flex min-h-12 cursor-pointer items-center text-body-md font-semibold text-primary">{d.warga.why}</summary>
        <div className="mt-sm"><Justification>{d.reason(a.reason, shelter.name)}</Justification></div>
      </details>
      <div className="mt-md grid gap-sm sm:grid-cols-2">
        <a href={`tel:${shelter.contact.replace(/[^0-9+]/g, '')}`} className={buttonCls('secondary', 'lg', true)}><Phone aria-hidden className="h-6 w-6" />{d.warga.callShelter}</a>
        {/* RULE 5: no route before the shelter has confirmed. */}
        {confirmed && (
          <a href={`https://www.openstreetmap.org/directions?route=;${shelter.lat},${shelter.lng}`} target="_blank" rel="noreferrer" className={buttonCls('secondary', 'lg', true)}>
            <Navigation aria-hidden className="h-6 w-6" />{d.warga.directions}
          </a>
        )}
      </div>
    </section>
  )
}

function FamilySwitch() {
  const d = useT()
  const { list } = useMyFamily()
  if (list.length < 2) return null
  return (
    <Link to="/warga/keluarga" className="pressable inline-flex min-h-12 items-center gap-xs rounded-full border-2 border-text-on-primary px-md text-body-md font-semibold hover:bg-primary-hover">
      <Users aria-hidden className="h-5 w-5" />{d.warga.switchFamily(list.length)}
    </Link>
  )
}

export function WargaHome() {
  const d = useT()
  const { state, dispatch } = useStore()
  const { fam } = useMyFamily()
  const a = currentAssignment(state, fam.id)
  const live = a && journeyKeys.includes(a.status) ? a : undefined
  const shelter = live && state.shelters.find((s) => s.id === live.shelterId)
  const hero = heroFor(d, state, fam, live, () => live && dispatch({ type: 'ready', id: live.id }))
  const t = toneCls[hero.tone]
  const shortcuts: { to: string; icon: LucideIcon; label: string; tone: Tone }[] = [
    { to: '/warga/kebutuhan', icon: Accessibility, label: d.warga.shortcut.needs, tone: 'blue' },
    { to: '/warga/kebutuhan#kode', icon: IdCard, label: d.warga.shortcut.code, tone: 'indigo' },
    { to: '/warga/keluarga', icon: Users, label: d.warga.shortcut.family, tone: 'green' },
    { to: '#tas-siaga', icon: Backpack, label: d.warga.shortcut.bag, tone: 'amber' },
  ]
  const tile = 'pressable flex min-h-[112px] flex-col justify-between gap-sm rounded-lg border border-border bg-background p-md hover:border-primary'

  return (
    <>
      <section className="bg-primary text-text-on-primary">
        <div className="mx-auto flex max-w-[640px] flex-wrap items-end justify-between gap-x-md gap-y-xs px-md pb-2xl pt-lg">
          <div>
            <p className="text-body-lg">{d.warga.hello}</p>
            <h1 className="text-h1">{fam.familyName}</h1>
            <p className="mt-xs text-body-md">{d.common.people(fam.memberCount)} · {d.common.code} <span className="font-mono font-semibold">{fam.code}</span></p>
          </div>
          <FamilySwitch />
        </div>
      </section>

      <div className="mx-auto -mt-xl flex max-w-[640px] flex-col gap-lg px-md">
        <section aria-labelledby="status-title" aria-live="polite" className={`enter rounded-lg border-2 p-5 ${t.bg} ${t.border}`}>
          <div className="flex items-start gap-md">
            <IconChip icon={hero.icon} tone={hero.tone} size={64} solid />
            <div className="flex-1">
              <p className={`text-body-sm font-semibold uppercase ${t.fg}`}>{d.warga.statusNow}</p>
              <h2 id="status-title" className="text-h2 text-text-primary">{hero.title}</h2>
            </div>
          </div>
          <p className="mt-md text-body-lg text-text-primary">{hero.body}</p>
          <div className={`mt-md flex flex-col gap-sm ${t.fg}`}>
            {hero.action}
            <div><ReadAloud text={`${hero.title}. ${hero.body}`} /></div>
          </div>
        </section>

        {live && (
          <section aria-labelledby="perjalanan" className="rounded-lg border border-border bg-background p-5">
            <h2 id="perjalanan" className="mb-md text-h3">{d.warga.journeyTitle}</h2>
            <Journey a={live} />
          </section>
        )}

        {live && shelter && <Destination shelter={shelter} a={live} />}

        <section aria-labelledby="pintasan">
          <h2 id="pintasan" className="mb-sm text-h3">{d.warga.shortcuts}</h2>
          <ul className="grid grid-cols-2 gap-sm">
            {shortcuts.map((q) => (
              <li key={q.label}>
                {q.to.startsWith('#') ? (
                  <a href={q.to} className={tile}><IconChip icon={q.icon} tone={q.tone} size={44} /><span className="text-body-lg font-semibold text-text-primary">{q.label}</span></a>
                ) : (
                  <Link to={q.to} className={tile}><IconChip icon={q.icon} tone={q.tone} size={44} /><span className="text-body-lg font-semibold text-text-primary">{q.label}</span></Link>
                )}
              </li>
            ))}
          </ul>
        </section>

        <section id="tas-siaga" aria-labelledby="tas" className="scroll-mt-24 rounded-lg border border-border bg-background p-5">
          <h2 id="tas" className="flex items-center gap-sm text-h3"><Backpack aria-hidden className="h-6 w-6 text-status-recommended" />{d.warga.bagTitle}</h2>
          <p className="mt-xs text-body-md text-text-secondary">{d.warga.bagHint}</p>
          <BagChecklist />
        </section>

        <p className="pb-md text-center text-body-sm text-text-secondary">{d.warga.footnote}</p>
      </div>
    </>
  )
}

function BagChecklist() {
  const d = useT()
  const [done, setDone] = useState<number[]>([])
  return (
    <ul className="mt-md flex flex-col gap-sm">
      {d.warga.bag.map((b, i) => {
        const on = done.includes(i)
        return (
          <li key={b}>
            <label className="pressable flex min-h-[56px] cursor-pointer items-center gap-md rounded-md border border-border px-md">
              <input type="checkbox" checked={on} onChange={() => setDone(on ? done.filter((x) => x !== i) : [...done, i])} className="h-7 w-7 shrink-0 accent-primary" />
              <span className={`text-body-lg ${on ? 'text-text-secondary line-through' : 'text-text-primary'}`}>{b}</span>
            </label>
          </li>
        )
      })}
    </ul>
  )
}

/* ---------- Family needs ---------- */

function NeedList({ needs }: { needs: FunctionalNeeds }) {
  const d = useT()
  const on = needKeys.filter((k) => needs[k])
  const extra = [
    needs.infantCount > 0 && { icon: Baby, label: d.needExtra.infants(needs.infantCount) },
    needs.pregnantCount > 0 && { icon: HeartHandshake, label: d.needExtra.pregnant(needs.pregnantCount) },
  ].filter(Boolean) as { icon: LucideIcon; label: string }[]
  if (!on.length && !extra.length) return <p className="text-body-lg text-text-primary">{d.warga.noNeeds}</p>
  return (
    <ul className="flex flex-col gap-sm">
      {on.map((k) => (
        <li key={k} className="flex items-center gap-md">
          <IconChip icon={needIcon[k]} tone="blue" size={44} />
          <span className="text-body-lg text-text-primary">
            {d.need[k].label}
            {k === 'medicalPowerRequired' && needs.minPowerWattage > 0 && <span className="text-text-secondary"> · {d.common.km(`${needs.minPowerWattage} W`)}</span>}
          </span>
        </li>
      ))}
      {extra.map((e) => (
        <li key={e.label} className="flex items-center gap-md"><IconChip icon={e.icon} tone="green" size={44} /><span className="text-body-lg">{e.label}</span></li>
      ))}
    </ul>
  )
}

export function WargaKebutuhan() {
  const d = useT()
  const { fam } = useMyFamily()
  const { state: nav, hash } = useLocation() as { state: { saved?: boolean } | null; hash: string }
  const locked = ['recommended', 'confirmed', 'in_transit'].includes(fam.status)
  const codeRef = useRef<HTMLElement>(null)
  useEffect(() => {
    if (hash === '#kode') codeRef.current?.scrollIntoView({ block: 'center' })
  }, [hash])
  return (
    <div className="mx-auto flex max-w-[640px] flex-col gap-lg px-md pt-lg">
      <header>
        <h1 className="text-h1">{d.warga.needsTitle}</h1>
        <p className="mt-xs text-body-lg text-text-secondary">{fam.familyName} · {d.common.people(fam.memberCount)}</p>
      </header>
      {nav?.saved && (
        <p role="status" className="enter flex items-center gap-sm rounded-lg border-2 border-status-arrived bg-tint-arrived p-md text-body-lg font-semibold text-status-arrived">
          <CircleCheckBig aria-hidden className="h-6 w-6" />{d.warga.saved}
        </p>
      )}
      <section aria-labelledby="kb" className="rounded-lg border border-border bg-background p-5">
        <h2 id="kb" className="mb-md text-h3">{d.warga.whatNeeded}</h2>
        <NeedList needs={fam.needs} />
        <dl className="mt-lg grid gap-md border-t border-border pt-md text-body-lg">
          <div><dt className="text-body-sm text-text-secondary">{d.warga.serviceLang}</dt><dd>{d.serviceLang(fam.needs.preferredLanguage)}</dd></div>
          <div><dt className="text-body-sm text-text-secondary">{d.warga.pickup}</dt><dd>{fam.addressNotes || '—'}</dd></div>
          <div><dt className="text-body-sm text-text-secondary">{d.warga.phone}</dt><dd>{fam.contactPhone || '—'}</dd></div>
        </dl>
      </section>
      {locked ? (
        <p className="rounded-lg border-2 border-status-recommended bg-tint-recommended p-md text-body-lg text-text-primary">{d.warga.locked}</p>
      ) : (
        <Link to="/warga/kebutuhan/ubah" className={buttonCls('primary', 'lg', true)}><Pencil aria-hidden className="h-6 w-6" />{d.warga.edit}</Link>
      )}
      <section ref={codeRef} id="kode" aria-labelledby="kode-h" className="rounded-lg border-2 border-dashed border-primary bg-background p-5 text-center">
        <h2 id="kode-h" className="text-h3">{d.warga.codeTitle}</h2>
        <p className="my-sm font-mono text-[clamp(2rem,1.5rem+2.2vw,2.5rem)] font-bold tracking-wider text-primary">{fam.code}</p>
        <p className="text-body-md text-text-secondary">{d.warga.codeHint}</p>
      </section>
    </div>
  )
}

/* ---------- Wizard: one question per screen ---------- */

export function NeedsWizard({ initial, onDone, onCancel }: { initial: Family; onDone: (f: Family) => void; onCancel: () => void }) {
  const d = useT()
  const w = d.wizard
  const [f, setF] = useState(initial)
  const [step, setStep] = useState(0)
  const [error, setError] = useState(false)
  const heading = useRef<HTMLHeadingElement>(null)
  const first = useRef(true)
  const setN = <K extends keyof FunctionalNeeds>(k: K, v: FunctionalNeeds[K]) => setF((x) => ({ ...x, needs: { ...x.needs, [k]: v } }))
  const { msg, locate } = useLocate((lat, lng) => setF((x) => ({ ...x, lat, lng })))

  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    heading.current?.focus()
    window.scrollTo({ top: 0 })
  }, [step])

  const noNeeds = !needKeys.some((k) => f.needs[k])
  const steps: { q: string; hint?: string; body: ReactNode; valid?: () => boolean }[] = [
    {
      q: w.nameQ,
      hint: w.nameHint,
      body: <TextInput label={w.nameLabel} big autoComplete="family-name" value={f.familyName} error={error ? w.nameError : undefined} onChange={(e) => { setF({ ...f, familyName: e.target.value }); setError(false) }} />,
      valid: () => !!f.familyName.trim(),
    },
    {
      q: w.peopleQ,
      hint: w.peopleHint,
      body: (
        <div className="flex flex-col gap-sm">
          <Counter label={w.people} value={f.memberCount} min={1} onChange={(v) => setF({ ...f, memberCount: v })} />
          <Counter label={w.infants} helper={w.included} value={f.needs.infantCount} max={f.memberCount} onChange={(v) => setN('infantCount', v)} />
          <Counter label={w.pregnant} helper={w.included} value={f.needs.pregnantCount} max={f.memberCount} onChange={(v) => setN('pregnantCount', v)} />
        </div>
      ),
    },
    {
      q: w.needsQ,
      hint: w.needsHint,
      body: (
        <fieldset className="flex flex-col gap-sm">
          <legend className="sr-only">{d.form.needsLegend}</legend>
          {needKeys.map((k) => (
            <div key={k} className="flex flex-col gap-sm">
              <ChoiceTile icon={needIcon[k]} label={d.need[k].label} description={d.need[k].description} checked={f.needs[k]} onChange={(v) => {
                setN(k, v)
                if (k === 'medicalPowerRequired' && v && !f.needs.minPowerWattage) setN('minPowerWattage', 300)
              }} />
              {k === 'medicalPowerRequired' && f.needs.medicalPowerRequired && (
                <fieldset className="ml-md rounded-lg border-l-4 border-primary bg-background p-md">
                  <legend className="sr-only">{w.deviceQ}</legend>
                  <p className="mb-sm text-body-lg font-semibold">{w.deviceQ}</p>
                  <div className="flex flex-col gap-sm">
                    {w.devices.map((p) => (
                      <ChoiceTile key={p.label} type="radio" name="watt" label={p.label} description={w.about(p.watt)} checked={f.needs.minPowerWattage === p.watt} onChange={() => setN('minPowerWattage', p.watt)} />
                    ))}
                  </div>
                </fieldset>
              )}
            </div>
          ))}
          <ChoiceTile icon={Check} label={w.noNeeds} checked={noNeeds} onChange={() => setF({ ...f, needs: { ...f.needs, ...Object.fromEntries(needKeys.map((k) => [k, false])), minPowerWattage: 0 } })} />
        </fieldset>
      ),
    },
    {
      q: w.pickupQ,
      hint: w.pickupHint,
      body: (
        <div className="flex flex-col gap-md">
          <Button size="lg" block icon={LocateFixed} onClick={locate}>{w.useLocation}</Button>
          <p role="status" className="text-body-md text-text-secondary">{msg}</p>
          <TextArea big label={w.landmark} helper={w.landmarkHint} value={f.addressNotes} onChange={(e) => setF({ ...f, addressNotes: e.target.value })} />
          <TextInput big label={w.phone} helper={w.phoneHint} type="tel" autoComplete="tel" inputMode="tel" value={f.contactPhone} onChange={(e) => setF({ ...f, contactPhone: e.target.value })} />
          <details className="rounded-lg border border-border bg-background p-md">
            <summary className="min-h-12 cursor-pointer py-sm text-body-md font-semibold text-primary">{w.manual}</summary>
            <div className="mt-sm grid gap-md sm:grid-cols-2">
              <TextInput label={w.lat} type="number" step="0.00001" value={f.lat} onChange={(e) => setF({ ...f, lat: Number(e.target.value) })} />
              <TextInput label={w.lng} type="number" step="0.00001" value={f.lng} onChange={(e) => setF({ ...f, lng: Number(e.target.value) })} />
            </div>
          </details>
        </div>
      ),
    },
    {
      q: w.langQ,
      body: (
        <fieldset className="flex flex-col gap-sm">
          <legend className="sr-only">{d.form.language}</legend>
          {region.serviceLanguages.map((l, i) => (
            <ChoiceTile key={l} type="radio" name="lang" icon={i === 0 ? Languages : undefined} label={d.serviceLang(l)} checked={f.needs.preferredLanguage === l} onChange={() => setN('preferredLanguage', l)} />
          ))}
        </fieldset>
      ),
    },
    {
      q: w.reviewQ,
      hint: w.reviewHint,
      body: (
        <div className="flex flex-col gap-sm">
          {[
            { label: w.review.name, value: f.familyName, go: 0 },
            { label: w.review.people, value: w.reviewPeople(f.memberCount, f.needs.infantCount, f.needs.pregnantCount), go: 1 },
            { label: w.review.needs, value: noNeeds ? w.noNeeds : needKeys.filter((k) => f.needs[k]).map((k) => d.need[k].label).join(', '), go: 2 },
            { label: w.review.pickup, value: f.addressNotes || w.notFilled, go: 3 },
            { label: w.review.lang, value: d.serviceLang(f.needs.preferredLanguage), go: 4 },
          ].map((r) => (
            <div key={r.label} className="flex items-start justify-between gap-md rounded-lg border border-border bg-background p-md">
              <div>
                <p className="text-body-sm text-text-secondary">{r.label}</p>
                <p className="text-body-lg font-semibold text-text-primary">{r.value}</p>
              </div>
              <button type="button" onClick={() => setStep(r.go)} className="pressable inline-flex min-h-12 shrink-0 cursor-pointer items-center gap-xs rounded-md px-sm text-body-md font-semibold text-primary underline">
                {d.common.change}<span className="sr-only"> {r.label}</span>
              </button>
            </div>
          ))}
          <p className="mt-sm text-body-md text-text-secondary">{w.privacy}</p>
        </div>
      ),
    },
  ]
  const last = step === steps.length - 1
  const s = steps[step]
  const next = () => {
    if (s.valid && !s.valid()) return setError(true)
    if (last) return onDone(f)
    setStep(step + 1)
  }
  return (
    <form className="mx-auto flex max-w-[640px] flex-col gap-lg px-md pt-lg" onSubmit={(e) => { e.preventDefault(); next() }} noValidate>
      <div>
        <p className="mb-xs text-body-md font-semibold text-text-secondary">{w.step(step + 1, steps.length)}</p>
        <Meter value={step + 1} max={steps.length} tone="blue" label={w.step(step + 1, steps.length)} />
      </div>
      <div className="enter" key={step}>
        <h1 ref={heading} tabIndex={-1} className="text-h1 outline-none">{s.q}</h1>
        {s.hint && <p className="mt-xs text-body-lg text-text-secondary">{s.hint}</p>}
        <div className="mt-lg">{s.body}</div>
      </div>
      <div className="flex flex-col gap-sm pb-lg">
        <Button type="submit" size="lg" block icon={last ? Save : undefined}>
          {last ? w.submit : <>{d.common.next}<ArrowRight aria-hidden className="h-6 w-6" /></>}
        </Button>
        <Button size="lg" variant="secondary" block icon={ArrowLeft} onClick={() => (step === 0 ? onCancel() : setStep(step - 1))}>
          {step === 0 ? d.common.cancel : d.common.back}
        </Button>
      </div>
    </form>
  )
}

export function WargaUbah() {
  const { dispatch } = useStore()
  const { fam } = useMyFamily()
  const navigate = useNavigate()
  return (
    <NeedsWizard
      key={fam.id}
      initial={fam}
      onCancel={() => navigate('/warga/kebutuhan')}
      onDone={(f) => {
        dispatch({ type: 'save_family', family: f })
        navigate('/warga/kebutuhan', { state: { saved: true } })
      }}
    />
  )
}

/* ---------- Supported families ---------- */

const newFamily = (): Family => {
  const id = crypto.randomUUID()
  return {
    id, code: `EVF-${id.slice(0, 4).toUpperCase()}`, familyName: '', memberCount: 1, contactPhone: '', lat: region.center.lat, lng: region.center.lng,
    addressNotes: '', status: 'idle', needs: { ...emptyNeeds }, registeredVia: 'caregiver',
  }
}

export function WargaKeluarga() {
  const d = useT()
  const { state } = useStore()
  const { fam: current, list, setFamId } = useMyFamily()
  const navigate = useNavigate()
  const ev = activeEvent(state)
  return (
    <div className="mx-auto flex max-w-[640px] flex-col gap-lg px-md pt-lg">
      <header>
        <h1 className="text-h1">{d.warga.familiesTitle}</h1>
        <p className="mt-xs text-body-lg text-text-secondary">{d.warga.familiesLead}</p>
      </header>
      <ul className="flex flex-col gap-sm">
        {list.map((f) => {
          const inZone = ev ? distanceKm(f, ev) <= ev.radiusKm : false
          return (
            <li key={f.id}>
              <button
                type="button"
                onClick={() => { setFamId(f.id); navigate('/warga') }}
                className={`pressable flex w-full cursor-pointer items-center gap-md rounded-lg border-2 bg-background p-md text-left ${f.id === current.id ? 'border-primary' : 'border-border hover:border-text-muted'}`}
              >
                <IconChip icon={Users} tone={f.id === current.id ? 'blue' : 'neutral'} size={48} />
                <span className="flex-1">
                  <span className="block text-body-lg font-semibold text-text-primary">{f.familyName}{f.registeredVia === 'caregiver' && <span className="font-normal text-text-secondary"> {d.warga.caregiverTag}</span>}</span>
                  <span className="block text-body-sm text-text-secondary">{d.common.people(f.memberCount)}{inZone ? ` · ${d.warga.inZone}` : ''}</span>
                  <span className="mt-xs block"><StatusBadge status={f.status} /></span>
                </span>
                <ArrowRight aria-hidden className="h-6 w-6 text-text-secondary" />
              </button>
            </li>
          )
        })}
      </ul>
      <Link to="/warga/keluarga/baru" className={buttonCls('primary', 'lg', true)}><UserPlus aria-hidden className="h-6 w-6" />{d.warga.register}</Link>
    </div>
  )
}

export function WargaBaru() {
  const { dispatch } = useStore()
  const { setFamId } = useMyFamily()
  const navigate = useNavigate()
  const [initial] = useState(newFamily)
  return (
    <NeedsWizard
      initial={initial}
      onCancel={() => navigate('/warga/keluarga')}
      onDone={(f) => {
        dispatch({ type: 'save_family', family: f })
        setFamId(f.id)
        navigate('/warga/kebutuhan', { state: { saved: true } })
      }}
    />
  )
}
