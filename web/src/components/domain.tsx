import { MapPin, Users } from 'lucide-react'
import type { ReactNode } from 'react'
import { region } from '../config'
import { useT, type Dict } from '../i18n'
import { formatKm } from '../lib/geo'
import { shelterLoad } from '../lib/matching'
import { needKeys, needSummary } from '../lib/needs'
import { useStore, type State } from '../state/store'
import type { Family, FunctionalNeeds, Shelter } from '../types'
import { CheckRow, FeatureBadge, Select, StatusBadge, TextInput } from './ui'

/** Demo persona (which family / shelter / volunteer "I" am), shared through the store so every panel agrees. */
export function usePersona(key: keyof State['persona']): [string, (v: string) => void] {
  const { state, dispatch } = useStore()
  return [state.persona[key], (value) => dispatch({ type: 'set_persona', key, value })]
}

/** REG-2: functional needs only, no diagnosis field (RULE 4). Flat list, no nested selects. */
export function NeedsChecklist({ value, onChange }: { value: FunctionalNeeds; onChange: (n: FunctionalNeeds) => void }) {
  const d = useT()
  const set = <K extends keyof FunctionalNeeds>(k: K, v: FunctionalNeeds[K]) => onChange({ ...value, [k]: v })
  return (
    <fieldset className="flex flex-col gap-sm">
      <legend className="mb-sm text-h3 text-text-primary">{d.form.needsLegend}</legend>
      <p className="-mt-xs mb-xs text-body-sm text-text-secondary">{d.form.needsHint}</p>
      {needKeys.map((k) => (
        <div key={k} className="flex flex-col gap-sm">
          <CheckRow label={d.need[k].label} description={d.need[k].description} checked={value[k]} onChange={(v) => set(k, v)} />
          {k === 'medicalPowerRequired' && value.medicalPowerRequired && (
            <div className="ml-xl">
              <TextInput
                label={d.form.watt}
                helper={d.form.wattHint}
                type="number"
                inputMode="numeric"
                min={0}
                step={50}
                value={value.minPowerWattage}
                onChange={(e) => set('minPowerWattage', Math.max(0, Number(e.target.value)))}
              />
            </div>
          )}
        </div>
      ))}
      <div className="mt-sm grid gap-md sm:grid-cols-2">
        <TextInput label={d.form.infants} type="number" inputMode="numeric" min={0} value={value.infantCount} onChange={(e) => set('infantCount', Math.max(0, Number(e.target.value)))} />
        <TextInput label={d.form.pregnant} type="number" inputMode="numeric" min={0} value={value.pregnantCount} onChange={(e) => set('pregnantCount', Math.max(0, Number(e.target.value)))} />
      </div>
      <Select label={d.form.language} value={value.preferredLanguage} onChange={(e) => set('preferredLanguage', e.target.value)}>
        {region.serviceLanguages.map((l) => <option key={l} value={l}>{d.serviceLang(l)}</option>)}
      </Select>
    </fieldset>
  )
}

export function NeedBadges({ family }: { family: Family }) {
  const d = useT()
  const items = needSummary(family.needs, d)
  if (!items.length) return <FeatureBadge muted>{d.needExtra.noNeeds}</FeatureBadge>
  return (
    <ul className="flex flex-wrap gap-xs" aria-label={d.form.needsLegend}>
      {items.map((t) => (
        <li key={t}><FeatureBadge muted>{t}</FeatureBadge></li>
      ))}
    </ul>
  )
}

export function shelterFeatureLabels(s: Shelter, d: Dict): string[] {
  const f = s.features
  const out: string[] = []
  if (f.hasRamp && f.rampSlopeCompliant) out.push(d.features.ramp)
  if (f.doorWidthAccessible) out.push(d.features.door)
  if (f.hasAccessibleToilet) out.push(d.features.toilet(f.accessibleToiletCount))
  if (f.hasMedicalPower) out.push(d.features.power(f.backupGeneratorCapacityWatt))
  if (f.hasCaregiverRooms) out.push(d.features.caregiver)
  return out
}

/** Shelter Card (DESIGN.md §Components 2): name, distance, beds left, green accessibility badges, full-width action. */
export function ShelterCard({ shelter, distance, children, headingLevel = 3 }: { shelter: Shelter; distance?: number; children?: ReactNode; headingLevel?: 2 | 3 }) {
  const d = useT()
  const { state } = useStore()
  const load = shelterLoad(shelter, state.assignments, new Map(state.families.map((f) => [f.id, f])))
  const H = headingLevel === 2 ? 'h2' : 'h3'
  const features = shelterFeatureLabels(shelter, d)
  return (
    <article className="flex h-full flex-col gap-md rounded-lg border border-border bg-background p-5">
      <div className="flex flex-wrap items-start justify-between gap-sm">
        <div>
          <H className={headingLevel === 2 ? 'text-h3' : 'text-h3'}>{shelter.name}</H>
          <p className="mt-xs flex items-center gap-xs text-body-sm text-text-secondary">
            <MapPin aria-hidden className="h-4 w-4 shrink-0" />
            {shelter.address}
          </p>
        </div>
        <StatusBadge status={shelter.verificationStatus} />
      </div>
      <dl className="grid grid-cols-2 gap-sm rounded-md bg-surface p-sm text-body-md sm:grid-cols-3">
        {distance !== undefined && (
          <div>
            <dt className="text-body-sm text-text-secondary">{d.shelterCard.distance}</dt>
            <dd className="font-semibold">{formatKm(distance)}</dd>
          </div>
        )}
        <div>
          <dt className="text-body-sm text-text-secondary">{d.shelterCard.remaining}</dt>
          <dd className="flex items-center gap-xs font-semibold tabular-nums"><Users aria-hidden className="h-4 w-4" />{d.shelterCard.of(load.remaining, shelter.totalCapacity)}</dd>
        </div>
        <div>
          <dt className="text-body-sm text-text-secondary">{d.shelterCard.status}</dt>
          <dd className="font-semibold">{d.opStatus[shelter.operationalStatus]}</dd>
        </div>
      </dl>
      {features.length > 0 ? (
        <ul className="flex flex-wrap gap-xs" aria-label={d.shelterCard.features}>
          {/* Unverified declarations are shown muted: they do not count for matching (SHLT-5). */}
          {features.map((t) => <li key={t}><FeatureBadge muted={shelter.verificationStatus !== 'verified'}>{t}</FeatureBadge></li>)}
        </ul>
      ) : (
        <p className="text-body-sm text-text-secondary">{d.features.plain}</p>
      )}
      {children && <div className="mt-auto">{children}</div>}
    </article>
  )
}
