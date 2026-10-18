// Single-page family form for trained staff (field triage, OFFL-2). Citizens use the step-by-step NeedsWizard instead.
import { Save } from 'lucide-react'
import { useState } from 'react'
import { useT } from '../i18n'
import type { Family } from '../types'
import { NeedsChecklist } from './domain'
import { LocationPicker } from './LocationPicker'
import { Button, TextArea, TextInput } from './ui'

export function FamilyForm({ initial, onSaved, submitLabel }: { initial: Family; onSaved: (f: Family) => void; submitLabel: string }) {
  const d = useT()
  const [f, setF] = useState(initial)
  const set = <K extends keyof Family>(k: K, v: Family[K]) => setF({ ...f, [k]: v })
  return (
    <form
      className="flex max-w-[720px] flex-col gap-lg rounded-lg border border-border bg-background p-md sm:p-lg"
      onSubmit={(e) => {
        e.preventDefault()
        onSaved(f)
      }}
    >
      <fieldset className="flex flex-col gap-md">
        <legend className="mb-sm text-h3">{d.form.family}</legend>
        <TextInput label={d.form.name} required value={f.familyName} onChange={(e) => set('familyName', e.target.value)} placeholder={d.form.namePh} />
        <TextInput label={d.form.members} type="number" inputMode="numeric" min={1} required value={f.memberCount} onChange={(e) => set('memberCount', Math.max(1, Number(e.target.value)))} />
        <TextInput label={d.form.phone} type="tel" autoComplete="tel" helper={d.form.phoneHint} value={f.contactPhone} onChange={(e) => set('contactPhone', e.target.value)} />
        <TextArea label={d.form.pickup} value={f.addressNotes} onChange={(e) => set('addressNotes', e.target.value)} placeholder={d.form.pickupPh} />
        <LocationPicker value={f} onChange={(p) => setF((x) => ({ ...x, ...p }))} />
      </fieldset>
      <NeedsChecklist value={f.needs} onChange={(needs) => set('needs', needs)} />
      <Button type="submit" block icon={Save}>{submitLabel}</Button>
    </form>
  )
}
