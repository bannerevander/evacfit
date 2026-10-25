// Primitive components built strictly from DESIGN.md tokens (front-matter `components`).
import {
  AlertTriangle, Check, CheckCircle2, Clock, Hourglass, Home, Minus, Plus, Shuffle, ShieldCheck, Truck, Volume2, VolumeX, XCircle, type LucideIcon,
} from 'lucide-react'
import { useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { useT } from '../i18n'
import { localeTag } from '../i18n/format'
import type { AssignmentStatus, FamilyStatus, VerificationStatus } from '../types'

const cx = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(' ')

type Variant = 'primary' | 'emergency' | 'secondary' | 'danger-outline'

const variants: Record<Variant, string> = {
  primary: 'bg-primary text-text-on-primary hover:bg-primary-hover active:bg-primary-active',
  emergency: 'bg-accent-emergency text-text-on-primary hover:bg-accent-emergency-hover',
  secondary: 'bg-background text-text-primary border border-text-muted hover:bg-surface-subtle',
  'danger-outline': 'bg-background text-status-rejected border border-status-rejected hover:bg-tint-rejected',
}

/** size "lg" = 60px, the citizen-facing size (older users: 48px is the floor, ~60px works better). */
export function buttonCls(variant: Variant = 'primary', size: 'md' | 'lg' = 'md', block?: boolean) {
  return cx(
    'pressable inline-flex cursor-pointer items-center justify-center gap-sm rounded-md font-semibold',
    size === 'lg' ? 'min-h-[60px] px-lg py-3 text-body-lg' : 'min-h-12 px-lg py-3 text-body-md',
    'disabled:cursor-not-allowed disabled:border-border disabled:bg-surface-subtle disabled:text-text-muted',
    variants[variant],
    block && 'w-full',
  )
}

export function Button({
  variant = 'primary', size = 'md', block, icon: Icon, className, children, ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'md' | 'lg'; block?: boolean; icon?: LucideIcon }) {
  return (
    <button type="button" {...rest} className={cx(buttonCls(variant, size, block), className)}>
      {Icon && <Icon aria-hidden className={size === 'lg' ? 'h-6 w-6 shrink-0' : 'h-5 w-5 shrink-0'} />}
      {children}
    </button>
  )
}

export type Tone = 'neutral' | 'amber' | 'blue' | 'indigo' | 'green' | 'red' | 'orange'

export const toneCls: Record<Tone, { bg: string; fg: string; border: string }> = {
  neutral: { bg: 'bg-surface-subtle', fg: 'text-text-primary', border: 'border-text-muted' },
  amber: { bg: 'bg-tint-recommended', fg: 'text-status-recommended', border: 'border-status-recommended' },
  blue: { bg: 'bg-tint-confirmed', fg: 'text-status-confirmed', border: 'border-status-confirmed' },
  indigo: { bg: 'bg-tint-in-transit', fg: 'text-status-in-transit', border: 'border-status-in-transit' },
  green: { bg: 'bg-tint-arrived', fg: 'text-status-arrived', border: 'border-status-arrived' },
  red: { bg: 'bg-tint-rejected', fg: 'text-status-rejected', border: 'border-status-rejected' },
  orange: { bg: 'bg-tint-unverified', fg: 'text-status-unverified', border: 'border-status-unverified' },
}

/** Round tinted medallion that carries an icon; size in px. */
export function IconChip({ icon: Icon, tone = 'blue', size = 40, solid }: { icon: LucideIcon; tone?: Tone; size?: number; solid?: boolean }) {
  const t = toneCls[tone]
  return (
    <span
      aria-hidden
      className={cx('inline-flex shrink-0 items-center justify-center rounded-full', solid ? 'bg-background' : t.bg, t.fg)}
      style={{ width: size, height: size }}
    >
      <Icon style={{ width: size * 0.5, height: size * 0.5 }} strokeWidth={2.25} />
    </span>
  )
}

/** Capacity / progress bar. Always paired with a visible text value (colour is never the only cue). */
export function Meter({ value, max, label, tone }: { value: number; max: number; label: string; tone?: Tone }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  const auto: Tone = pct >= 100 ? 'red' : pct >= 85 ? 'amber' : 'green'
  const fill = { neutral: 'bg-text-secondary', amber: 'bg-status-recommended', blue: 'bg-primary', indigo: 'bg-status-in-transit', green: 'bg-status-arrived', red: 'bg-status-rejected', orange: 'bg-status-unverified' }[tone ?? auto]
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} className="h-2.5 w-full overflow-hidden rounded-full bg-surface-subtle ring-1 ring-inset ring-border">
      <div className={cx('h-full rounded-full', fill)} style={{ width: `${pct}%` }} />
    </div>
  )
}

/** Big −/+ stepper: easier than typing numbers for older users and tremor. */
export function Counter({ label, value, onChange, min = 0, max = 30, helper }: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; helper?: string }) {
  const d = useT()
  const id = useId()
  const btn = 'pressable inline-flex h-14 w-14 shrink-0 cursor-pointer items-center justify-center rounded-full border-2 border-primary bg-background text-primary disabled:cursor-not-allowed disabled:border-border disabled:text-text-muted'
  return (
    <div className="flex items-center justify-between gap-md rounded-lg border border-border bg-background p-md">
      <div>
        <p id={id} className="text-body-lg font-semibold text-text-primary">{label}</p>
        {helper && <p className="text-body-sm text-text-secondary">{helper}</p>}
      </div>
      <div role="group" aria-labelledby={id} className="flex items-center gap-sm">
        <button type="button" className={btn} disabled={value <= min} onClick={() => onChange(value - 1)} aria-label={d.wizard.decrease(label)}>
          <Minus aria-hidden className="h-6 w-6" strokeWidth={3} />
        </button>
        <output aria-live="polite" className="w-10 text-center text-h2 tabular-nums text-text-primary">{value}</output>
        <button type="button" className={btn} disabled={value >= max} onClick={() => onChange(value + 1)} aria-label={d.wizard.increase(label)}>
          <Plus aria-hidden className="h-6 w-6" strokeWidth={3} />
        </button>
      </div>
    </div>
  )
}

/** Large icon tile wrapping a real checkbox/radio, so screen readers get native semantics. */
export function ChoiceTile({ type = 'checkbox', name, icon: Icon, label, description, checked, onChange }: {
  type?: 'checkbox' | 'radio'; name?: string; icon?: LucideIcon; label: string; description?: string; checked: boolean; onChange: (v: boolean) => void
}) {
  return (
    <label className={cx('pressable flex min-h-[72px] cursor-pointer items-center gap-md rounded-lg border-2 p-md', checked ? 'border-primary bg-tint-confirmed' : 'border-border bg-background hover:border-text-muted')}>
      {Icon && <IconChip icon={Icon} tone={checked ? 'blue' : 'neutral'} size={48} solid={checked} />}
      <span className="flex-1">
        <span className="block text-body-lg font-semibold text-text-primary">{label}</span>
        {description && <span className="block text-body-sm text-text-secondary">{description}</span>}
      </span>
      <input type={type} name={name} checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-7 w-7 shrink-0 cursor-pointer accent-primary" />
    </label>
  )
}

/** Reads text aloud with the browser's speech engine (helps low literacy / low vision). Hidden if unsupported. */
export function ReadAloud({ text }: { text: string }) {
  const d = useT()
  const [speaking, setSpeaking] = useState(false)
  useEffect(() => () => window.speechSynthesis?.cancel(), [])
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null
  const toggle = () => {
    const s = window.speechSynthesis
    if (speaking) {
      s.cancel()
      return setSpeaking(false)
    }
    const u = new SpeechSynthesisUtterance(text)
    u.lang = localeTag()
    u.rate = 0.9
    u.onend = () => setSpeaking(false)
    s.cancel()
    s.speak(u)
    setSpeaking(true)
  }
  return (
    <button type="button" onClick={toggle} aria-pressed={speaking} className="pressable inline-flex min-h-12 cursor-pointer items-center gap-sm rounded-full border border-current px-md text-body-md font-semibold">
      {speaking ? <VolumeX aria-hidden className="h-5 w-5" /> : <Volume2 aria-hidden className="h-5 w-5" />}
      {speaking ? d.warga.stop : d.warga.listen}
    </button>
  )
}

type BadgeKind = AssignmentStatus | FamilyStatus | VerificationStatus

const badgeStyle: Record<BadgeKind, { cls: string; icon: LucideIcon }> = {
  recommended: { cls: 'bg-tint-recommended text-status-recommended', icon: Clock },
  confirmed: { cls: 'bg-tint-confirmed text-status-confirmed', icon: ShieldCheck },
  in_transit: { cls: 'bg-tint-in-transit text-status-in-transit', icon: Truck },
  arrived: { cls: 'bg-tint-arrived text-status-arrived', icon: CheckCircle2 },
  rejected: { cls: 'bg-tint-rejected text-status-rejected', icon: XCircle },
  reallocated: { cls: 'bg-tint-unverified text-status-unverified', icon: Shuffle },
  waiting_match: { cls: 'bg-tint-unverified text-status-unverified', icon: Hourglass },
  idle: { cls: 'bg-surface-subtle text-text-secondary', icon: Home },
  cancelled: { cls: 'bg-surface-subtle text-text-secondary', icon: XCircle },
  verified: { cls: 'bg-tint-arrived text-status-arrived', icon: ShieldCheck },
  unverified: { cls: 'bg-tint-unverified text-status-unverified', icon: AlertTriangle },
}

/** DESIGN.md: pill badge, always icon + text (never colour alone). */
export function StatusBadge({ status }: { status: BadgeKind }) {
  const d = useT()
  const { cls, icon: Icon } = badgeStyle[status]
  const label = status === 'verified' || status === 'unverified' ? d.verification[status] : status in d.assignmentStatus ? d.assignmentStatus[status as AssignmentStatus] : d.familyStatus[status as FamilyStatus]
  return (
    <span className={cx('inline-flex items-center gap-xs whitespace-nowrap rounded-full px-[10px] py-xs text-body-sm font-semibold', cls)}>
      <Icon aria-hidden className="h-4 w-4" />
      {label}
    </span>
  )
}

/** Green accessibility badge on shelter cards ("Rampa Terverifikasi", "Toilet Difabel", ...). */
export function FeatureBadge({ children, muted }: { children: ReactNode; muted?: boolean }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-xs rounded-full px-[10px] py-xs text-body-sm font-medium',
        muted ? 'bg-surface-subtle text-text-secondary' : 'bg-tint-arrived text-status-arrived',
      )}
    >
      {!muted && <Check aria-hidden className="h-4 w-4" />}
      {children}
    </span>
  )
}

export function Card({ children, className, subtle, as: Tag = 'section', ...rest }: {
  children: ReactNode; className?: string; subtle?: boolean; as?: 'section' | 'article' | 'div' | 'li'; 'aria-labelledby'?: string
}) {
  return (
    <Tag {...rest} className={cx('rounded-lg border border-border', subtle ? 'bg-surface-subtle p-md text-text-secondary' : 'bg-background p-5', className)}>
      {children}
    </Tag>
  )
}

export function PageHeader({ title, eyebrow, description, actions }: { title: string; eyebrow?: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-lg flex flex-col gap-md md:flex-row md:items-end md:justify-between">
      <div>
        {eyebrow && <p className="mb-xs text-caption uppercase text-primary">{eyebrow}</p>}
        <h1 className="text-h1 text-text-primary">{title}</h1>
        {description && <p className="mt-xs text-body-md text-text-secondary">{description}</p>}
      </div>
      {actions && <div className="flex flex-col gap-sm sm:flex-row sm:flex-wrap sm:items-end [&>*]:w-full sm:[&>*]:w-auto">{actions}</div>}
    </header>
  )
}

/** Titled white panel on the grey page: the main building block of staff screens. */
export function Panel({ title, icon, tone = 'blue', actions, children, className, bodyClass, id }: {
  title: ReactNode; icon?: LucideIcon; tone?: Tone; actions?: ReactNode; children: ReactNode; className?: string; bodyClass?: string; id?: string
}) {
  const hid = useId()
  return (
    <section aria-labelledby={id ?? hid} className={cx('flex min-w-0 flex-col rounded-lg border border-border bg-background', className)}>
      <header className="flex min-h-14 items-center gap-sm border-b border-border px-md py-sm">
        {icon && <IconChip icon={icon} tone={tone} size={32} />}
        <h2 id={id ?? hid} className="flex-1 text-body-lg font-semibold text-text-primary">{title}</h2>
        {actions}
      </header>
      <div className={cx('flex-1 p-md', bodyClass)}>{children}</div>
    </section>
  )
}

const inputCls = 'min-h-12 w-full rounded-md border border-text-muted bg-background px-md py-3 text-body-md text-text-primary placeholder:text-text-muted'
const inputBig = 'min-h-[60px] w-full rounded-md border-2 border-text-muted bg-background px-md py-3 text-body-lg text-text-primary placeholder:text-text-muted'

export function Field({ label, helper, error, big, children, id }: {
  label: string; helper?: string; error?: string; big?: boolean; children: (id: string, describedBy?: string) => ReactNode; id?: string
}) {
  const auto = useId()
  const fid = id ?? auto
  const ids = [helper && `${fid}-help`, error && `${fid}-err`].filter(Boolean).join(' ') || undefined
  return (
    <div className="flex flex-col gap-xs">
      <label htmlFor={fid} className={cx('font-semibold text-text-primary', big ? 'text-body-lg' : 'text-body-md')}>{label}</label>
      {helper && <p id={`${fid}-help`} className="text-body-sm text-text-secondary">{helper}</p>}
      {error && (
        <p id={`${fid}-err`} role="alert" className="flex items-center gap-xs text-body-md font-semibold text-status-rejected">
          <AlertTriangle aria-hidden className="h-5 w-5 shrink-0" />
          {error}
        </p>
      )}
      {children(fid, ids)}
    </div>
  )
}

export function TextInput({ label, helper, error, big, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label: string; helper?: string; error?: string; big?: boolean }) {
  return (
    <Field label={label} helper={helper} error={error} big={big}>
      {(id, d) => <input id={id} aria-describedby={d} aria-invalid={error ? true : undefined} className={cx(big ? inputBig : inputCls, error && '!border-status-rejected')} {...rest} />}
    </Field>
  )
}

export function TextArea({ label, helper, big, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; helper?: string; big?: boolean }) {
  return <Field label={label} helper={helper} big={big}>{(id, d) => <textarea id={id} aria-describedby={d} rows={3} className={big ? inputBig : inputCls} {...rest} />}</Field>
}

export function Select({ label, helper, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { label: string; helper?: string }) {
  return (
    <Field label={label} helper={helper}>
      {(id, d) => <select id={id} aria-describedby={d} className={inputCls} {...rest}>{children}</select>}
    </Field>
  )
}

/** Large 24px checkbox with clickable label + functional description (DESIGN.md §Components 1). */
export function CheckRow({ label, description, checked, onChange, disabled }: {
  label: string; description?: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean
}) {
  const id = useId()
  return (
    <div className={cx('flex min-h-12 items-start gap-md rounded-md border px-md py-3', checked ? 'border-primary bg-tint-confirmed/40' : 'border-border bg-background')}>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        aria-describedby={description ? `${id}-d` : undefined}
        className="mt-0.5 h-6 w-6 shrink-0 cursor-pointer accent-primary"
      />
      <label htmlFor={id} className="cursor-pointer">
        <span className="block text-body-md font-semibold text-text-primary">{label}</span>
        {description && <span id={`${id}-d`} className="block text-body-sm text-text-secondary">{description}</span>}
      </label>
    </div>
  )
}

/** Matching Justification Drawer: light grey box with blue left border. */
export function Justification({ children }: { children: ReactNode }) {
  const d = useT()
  return (
    <div className="rounded-r-md border-l-4 border-primary bg-surface-subtle p-md">
      <p className="mb-xs text-caption uppercase text-text-secondary">{d.reasonTitle}</p>
      <p className="text-body-md text-text-primary">{children}</p>
    </div>
  )
}

export function Stat({ label, value, tone, icon, chip = 'neutral' }: { label: string; value: ReactNode; tone?: 'danger' | 'ok'; icon?: LucideIcon; chip?: Tone }) {
  return (
    <div className="flex min-w-0 flex-col items-start gap-sm rounded-lg border border-border bg-background p-md sm:flex-row sm:items-center sm:gap-md">
      {icon && <IconChip icon={icon} tone={chip} size={44} />}
      <div className="min-w-0 [overflow-wrap:anywhere]">
        <p className="text-body-sm text-text-secondary">{label}</p>
        <p className={cx('text-h2 tabular-nums', tone === 'danger' ? 'text-status-rejected' : tone === 'ok' ? 'text-status-arrived' : 'text-text-primary')}>{value}</p>
      </div>
    </div>
  )
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-text-muted bg-background p-lg text-center">
      <p className="text-h3 text-text-primary">{title}</p>
      {children && <div className="mt-xs text-body-md text-text-secondary">{children}</div>}
    </div>
  )
}

/** Native <dialog> modal: focus trap, Esc and backdrop handled by the browser. */
/** `wide` fits a full two-column form (e.g. the shelter form) on desktop. */
export function Dialog({ open, onClose, title, children, wide = false }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      className={`${wide ? 'w-[min(100%-32px,1128px)]' : 'w-[min(100%-32px,560px)]'} rounded-lg border border-border bg-background p-0 text-text-primary backdrop:bg-text-primary/50`}
    >
      <div className="max-h-[85vh] overflow-y-auto p-lg">
        <h2 id={titleId} className="mb-md text-h2">{title}</h2>
        {children}
      </div>
    </dialog>
  )
}
