// Two shells: CitizenLayout (mobile-first, one column, bottom nav) and StaffLayout (sidebar on laptop, bottom nav on phone).
import {
  AlertOctagon, AlertTriangle, Building2, Check, Contrast, HeartHandshake, Info, Phone, RadioTower, Settings2, Truck, Type, Wifi, WifiOff, X, type LucideIcon,
} from 'lucide-react'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { region } from '../config'
import { useT, type Dict } from '../i18n'
import { fmtNum } from '../i18n/format'
import { activeEvent, useStore, type Alert, type State } from '../state/store'
import type { Lang } from '../types'
import { IconChip, type Tone } from './ui'

export function Logo({ className = 'h-8' }: { className?: string }) {
  return <img src="/brand/evacfit-logo.webp" alt="EvacFit" className={`w-auto ${className}`} width={420} height={112} />
}

export function Mark({ className = 'h-8' }: { className?: string }) {
  return <img src="/brand/evacfit-mark.png" alt="EvacFit" className={`w-auto ${className}`} width={176} height={128} />
}

function OfflineBanner() {
  const d = useT()
  const { state } = useStore()
  if (!state.offline) return null
  return (
    <div role="status" className="sticky top-0 z-[1100] flex min-h-10 items-center gap-sm bg-tint-recommended px-md text-body-sm font-semibold text-status-recommended">
      <WifiOff aria-hidden className="h-4 w-4 shrink-0" />
      <span>{d.layout.offlineBanner}</span>
      {state.outbox.length > 0 && <span className="ml-auto whitespace-nowrap">{d.layout.queued(state.outbox.length)}</span>}
    </div>
  )
}

/** ID / EN switch. Each button carries its language's own name for screen readers. */
export function LangSwitch({ big }: { big?: boolean }) {
  const d = useT()
  const { state, dispatch } = useStore()
  const langs: Lang[] = ['id', 'en']
  return (
    <div role="group" aria-label={d.a11y.language} className={`inline-flex rounded-md border border-text-muted bg-background p-0.5 ${big ? 'w-full' : ''}`}>
      {langs.map((l) => (
        <button
          key={l}
          type="button"
          lang={l}
          aria-pressed={state.lang === l}
          aria-label={d.langName[l]}
          onClick={() => dispatch({ type: 'set_lang', lang: l })}
          className={`pressable inline-flex cursor-pointer items-center justify-center rounded-[4px] font-bold ${big ? 'min-h-14 flex-1 gap-xs text-body-md' : 'min-h-11 min-w-11 px-sm text-body-sm'} ${
            state.lang === l ? 'bg-primary text-text-on-primary' : 'text-text-primary hover:bg-surface-subtle'
          }`}
        >
          {big ? (
            <>
              {state.lang === l && <Check aria-hidden className="h-5 w-5" />}
              {d.langName[l]}
            </>
          ) : (
            l.toUpperCase()
          )}
        </button>
      ))}
    </div>
  )
}

const prefItems: { key: keyof State['prefs']; icon: LucideIcon }[] = [
  { key: 'simpleText', icon: Type },
  { key: 'highContrast', icon: Contrast },
]

/** "Large Text" is a citizen feature; staff screens only get the contrast toggle. */
export function A11yToggles({ labels, only }: { labels?: boolean; only?: (keyof State['prefs'])[] }) {
  const d = useT()
  const { state, dispatch } = useStore()
  const items = only ? prefItems.filter((i) => only.includes(i.key)) : prefItems
  const name = (k: keyof State['prefs']) => (k === 'simpleText' ? d.a11y.textLarge : d.a11y.highContrast)
  return (
    <div className="flex gap-sm">
      {items.map((i) => {
        const on = state.prefs[i.key]
        return (
          <button
            key={i.key}
            type="button"
            aria-pressed={on}
            title={name(i.key)}
            onClick={() => dispatch({ type: 'set_pref', key: i.key, value: !on })}
            className={`pressable inline-flex min-h-12 min-w-12 cursor-pointer items-center justify-center gap-xs rounded-md border px-sm text-body-sm font-semibold ${
              on ? 'border-primary bg-primary text-text-on-primary' : 'border-text-muted bg-background text-text-primary hover:bg-surface-subtle'
            }`}
          >
            <i.icon aria-hidden className="h-5 w-5" />
            {labels ? <span>{name(i.key)}</span> : <span className="sr-only">{name(i.key)}</span>}
          </button>
        )
      })}
    </div>
  )
}

/** Citizen "Display" menu: language, large text, high contrast — one labelled button so the header fits a 320px phone. */
function DisplayMenu() {
  const d = useT()
  const { state, dispatch } = useStore()
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const pid = useId()
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    const onDown = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false)
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onDown)
    }
  }, [open])
  const row = (k: keyof State['prefs'], Icon: LucideIcon, label: string) => {
    const on = state.prefs[k]
    return (
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={() => dispatch({ type: 'set_pref', key: k, value: !on })}
        className="pressable flex min-h-14 w-full cursor-pointer items-center gap-md rounded-md border border-border px-md text-left hover:bg-surface"
      >
        <Icon aria-hidden className="h-6 w-6 text-primary" />
        <span className="flex-1 text-body-lg font-semibold text-text-primary">{label}</span>
        <span aria-hidden className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${on ? 'bg-primary' : 'bg-text-muted'}`}>
          <span className={`absolute top-1 h-5 w-5 rounded-full bg-background transition-transform ${on ? 'translate-x-6' : 'translate-x-1'}`} />
        </span>
      </button>
    )
  }
  return (
    <div ref={box} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={pid}
        onClick={() => setOpen(!open)}
        className={`pressable inline-flex min-h-12 cursor-pointer items-center gap-xs rounded-md border px-sm text-body-md font-semibold ${open ? 'border-primary bg-tint-confirmed text-status-confirmed' : 'border-text-muted bg-background text-text-primary'}`}
      >
        <Settings2 aria-hidden className="h-5 w-5" />
        {d.a11y.display}
      </button>
      {open && (
        <div id={pid} role="dialog" aria-label={d.a11y.displayTitle} className="enter absolute right-0 top-[calc(100%+8px)] z-[1200] flex w-[min(calc(100vw-32px),360px)] flex-col gap-sm rounded-lg border border-text-muted bg-background p-md">
          <p className="text-body-sm font-semibold uppercase text-text-secondary">{d.a11y.language}</p>
          <LangSwitch big />
          <p className="mt-sm text-body-sm font-semibold uppercase text-text-secondary">{d.a11y.display}</p>
          {row('simpleText', Type, d.a11y.textLarge)}
          {row('highContrast', Contrast, d.a11y.highContrast)}
        </div>
      )}
    </div>
  )
}

function EmergencyStrip({ compact }: { compact?: boolean }) {
  const d = useT()
  const { state } = useStore()
  const event = activeEvent(state)
  if (!event) return null
  return (
    <div className="bg-accent-emergency text-text-on-primary">
      <p className={`mx-auto flex items-center gap-sm px-md py-sm font-semibold ${compact ? 'max-w-[640px] text-body-md' : 'text-body-md lg:px-xl'}`}>
        <span aria-hidden className="live-dot inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-text-on-primary" />
        <span>
          {d.layout.eventActive(d.disasterType[event.type])}
          {!compact && <span className="hidden font-normal md:inline"> · {d.layout.eventDetail(event.title, fmtNum(event.radiusKm, 1))}</span>}
        </span>
      </p>
    </div>
  )
}

const alertStyle: Record<Alert['tone'], { cls: string; icon: LucideIcon }> = {
  info: { cls: 'border-primary bg-tint-confirmed text-status-confirmed', icon: Info },
  warning: { cls: 'border-status-unverified bg-tint-unverified text-status-unverified', icon: AlertTriangle },
  critical: { cls: 'border-status-rejected bg-tint-rejected text-status-rejected', icon: AlertOctagon },
}

/** Operational alerts name other families, so only the coordinator shell renders them (SEC-2). */
function Alerts() {
  const d = useT()
  const { state, dispatch } = useStore()
  const [latest, ...older] = state.alerts
  if (!latest) return null
  const row = (a: Alert) => {
    const { cls, icon: Icon } = alertStyle[a.tone]
    return (
      <div key={a.id} role={a.tone === 'critical' ? 'alert' : 'status'} className={`enter flex items-start gap-sm rounded-md border-l-4 px-md py-xs ${cls}`}>
        <Icon aria-hidden className="mt-3 h-5 w-5 shrink-0" />
        <p className="flex-1 py-sm text-body-md font-medium">{d.alert(a.msg)}</p>
        <button type="button" onClick={() => dispatch({ type: 'dismiss_alert', id: a.id })} className="inline-flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center rounded-md hover:bg-background/60">
          <X aria-hidden className="h-5 w-5" />
          <span className="sr-only">{d.a11y.closeNotice}</span>
        </button>
      </div>
    )
  }
  return (
    <div className="mb-lg flex flex-col gap-xs" aria-live="polite">
      {row(latest)}
      {older.length > 0 && (
        <details>
          <summary className="inline-flex min-h-10 cursor-pointer items-center text-body-sm font-semibold text-primary">{d.layout.olderNotices(older.length)}</summary>
          <div className="mt-xs flex flex-col gap-xs">{older.slice(0, 8).map(row)}</div>
        </details>
      )}
    </div>
  )
}

/** Connection + outbox state, always in the same corner of every staff screen. */
function SyncStatus() {
  const d = useT()
  const { state } = useStore()
  return (
    <p role="status" className={`hidden min-h-10 items-center gap-xs rounded-full px-md text-body-sm font-semibold sm:inline-flex ${state.offline ? 'bg-tint-recommended text-status-recommended' : 'bg-tint-arrived text-status-arrived'}`}>
      {state.offline ? <WifiOff aria-hidden className="h-4 w-4" /> : <Wifi aria-hidden className="h-4 w-4" />}
      {state.offline ? d.layout.offline(state.outbox.length) : d.layout.online}
    </p>
  )
}

/** Moves focus to <main> on route change so screen readers announce the new page (WCAG focus-on-route-change). */
function useFocusMain() {
  const ref = useRef<HTMLElement>(null)
  const { pathname } = useLocation()
  const first = useRef(true)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    ref.current?.focus({ preventScroll: true })
    window.scrollTo({ top: 0 })
  }, [pathname])
  return ref
}

function SkipLink() {
  const d = useT()
  return (
    <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-md focus:top-md focus:z-[1200] focus:rounded-md focus:bg-primary focus:px-md focus:py-3 focus:text-text-on-primary">
      {d.a11y.skip}
    </a>
  )
}

export interface NavItem {
  to: string
  label: (d: Dict) => string
  icon: LucideIcon
  end?: boolean
  count?: (s: State) => number
}

function BottomNav({ items, label, big }: { items: NavItem[]; label: string; big?: boolean }) {
  const d = useT()
  const { state } = useStore()
  return (
    <nav aria-label={label} className="pb-safe fixed inset-x-0 bottom-0 z-[1000] border-t border-border bg-background lg:hidden">
      <ul className="mx-auto grid max-w-[640px]" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
        {items.map((i) => {
          const n = i.count?.(state) ?? 0
          return (
            <li key={i.to}>
              <NavLink
                to={i.to}
                end={i.end}
                className={({ isActive }) => `flex flex-col items-center justify-center gap-[2px] pt-sm ${big ? 'min-h-[68px] text-body-sm' : 'min-h-[60px] text-caption'} font-semibold ${isActive ? 'text-primary' : 'text-text-secondary'}`}
              >
                {({ isActive }) => (
                  <>
                    <span className={`relative inline-flex h-8 w-16 items-center justify-center rounded-full ${isActive ? 'bg-tint-confirmed' : ''}`}>
                      <i.icon aria-hidden className={big ? 'h-7 w-7' : 'h-6 w-6'} strokeWidth={isActive ? 2.5 : 2} />
                      {n > 0 && <span className="absolute -right-0 -top-1 min-w-5 rounded-full bg-accent-emergency px-1 text-center text-caption text-text-on-primary">{n}</span>}
                    </span>
                    <span>{i.label(d)}{n > 0 && <span className="sr-only"> ({d.a11y.needsAction(n)})</span>}</span>
                  </>
                )}
              </NavLink>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

/* ---------- Citizen ---------- */

export function CitizenLayout({ items }: { items: NavItem[] }) {
  const d = useT()
  const main = useFocusMain()
  const { state } = useStore()
  useEffect(() => {
    const root = document.documentElement
    root.dataset.simple = state.prefs.simpleText ? 'on' : 'off'
    return () => {
      root.dataset.simple = 'off'
    }
  }, [state.prefs.simpleText])
  return (
    <div className="min-h-dvh bg-surface">
      <SkipLink />
      <OfflineBanner />
      <header className="sticky top-0 z-[1000] border-b border-border bg-background">
        <div className="mx-auto flex h-16 max-w-[640px] items-center gap-sm px-md">
          <Link to="/warga" className="mr-auto inline-flex min-h-12 shrink-0 items-center rounded-md" aria-label={d.layout.homeLink}>
            {/* Below 360px the full wordmark would push the labelled Display button off-screen. */}
            <Mark className="h-8 min-[360px]:hidden" />
            <Logo className="hidden h-7 min-[360px]:block" />
          </Link>
          {/* Consistent help (WCAG 3.2.6): the emergency call is in the same place on every citizen screen. */}
          <a href={`tel:${region.emergencyNumber}`} className="pressable inline-flex min-h-12 items-center gap-xs rounded-md bg-accent-emergency px-sm text-body-md font-bold text-text-on-primary hover:bg-accent-emergency-hover">
            <Phone aria-hidden className="h-5 w-5" />
            {region.emergencyNumber}<span className="sr-only"> — {d.emergency.call}</span>
          </a>
          <DisplayMenu />
        </div>
        <nav aria-label={d.nav.citizenMenu} className="mx-auto hidden max-w-[640px] px-md lg:block">
          <ul className="flex gap-xs">
            {items.map((i) => (
              <li key={i.to}>
                <NavLink to={i.to} end={i.end} className={({ isActive }) => `inline-flex min-h-12 items-center gap-sm border-b-[3px] px-md text-body-md font-semibold ${isActive ? 'border-primary text-primary' : 'border-transparent text-text-secondary hover:text-text-primary'}`}>
                  <i.icon aria-hidden className="h-5 w-5" />
                  {i.label(d)}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      <EmergencyStrip compact />
      <main id="main" ref={main} tabIndex={-1} className="pb-[112px] outline-none lg:pb-2xl">
        <Outlet />
      </main>
      <BottomNav items={items} label={d.nav.citizenMenu} big />
    </div>
  )
}

/* ---------- Staff (coordinator / shelter / field) ---------- */

export type StaffRole = 'coordinator' | 'shelter' | 'field'

const roleMeta: Record<StaffRole | 'citizen', { to: string; icon: LucideIcon; tone: Tone }> = {
  coordinator: { to: '/koordinator', icon: RadioTower, tone: 'red' },
  shelter: { to: '/posko', icon: Building2, tone: 'blue' },
  field: { to: '/relawan', icon: Truck, tone: 'indigo' },
  citizen: { to: '/warga', icon: HeartHandshake, tone: 'green' },
}

export function StaffLayout({ items, role, showAlerts, context }: { items: NavItem[]; role: StaffRole; showAlerts?: boolean; context?: ReactNode }) {
  const d = useT()
  const { state } = useStore()
  const main = useFocusMain()
  const meta = roleMeta[role]
  const roleName = d.roles[role]
  return (
    <div className="min-h-dvh bg-surface">
      <SkipLink />
      <OfflineBanner />
      <aside aria-label={d.layout.mainNav} className="fixed inset-y-0 left-0 z-[1001] hidden w-[272px] flex-col border-r border-border bg-background lg:flex">
        <Link to="/" className="mx-md mt-md inline-flex min-h-12 items-center rounded-md" aria-label={d.layout.pickRole}>
          <Logo className="h-8" />
        </Link>
        <div className="mx-md mt-lg flex items-center gap-sm rounded-lg bg-surface p-sm ring-1 ring-inset ring-border">
          <IconChip icon={meta.icon} tone={meta.tone} size={40} />
          <div className="min-w-0">
            <p className="text-caption uppercase text-text-secondary">{d.layout.activeRole}</p>
            <p className="text-body-md font-bold text-text-primary">{roleName}</p>
          </div>
        </div>
        <nav aria-label={roleName} className="mt-md px-sm">
          <ul className="flex flex-col gap-xs">
            {items.map((i) => {
              const n = i.count?.(state) ?? 0
              return (
                <li key={i.to}>
                  <NavLink
                    to={i.to}
                    end={i.end}
                    className={({ isActive }) => `pressable relative flex min-h-12 items-center gap-md rounded-md px-md text-body-md font-semibold ${isActive ? 'bg-tint-confirmed text-status-confirmed before:absolute before:inset-y-2 before:left-0 before:w-1 before:rounded-full before:bg-primary' : 'text-text-secondary hover:bg-surface-subtle hover:text-text-primary'}`}
                  >
                    <i.icon aria-hidden className="h-5 w-5" />
                    <span className="flex-1">{i.label(d)}</span>
                    {n > 0 && <span className="rounded-full bg-accent-emergency px-sm text-body-sm text-text-on-primary">{n}<span className="sr-only"> {d.a11y.needsAction(n)}</span></span>}
                  </NavLink>
                </li>
              )
            })}
          </ul>
        </nav>
        <div className="mt-auto border-t border-border p-md">
          <p className="mb-xs text-caption uppercase text-text-secondary">{d.layout.switchRole}</p>
          <ul className="flex flex-wrap gap-xs">
            {(Object.keys(roleMeta) as (StaffRole | 'citizen')[]).filter((r) => r !== role).map((r) => (
              <li key={r}><Link to={roleMeta[r].to} className="inline-flex min-h-10 items-center rounded-full border border-border px-sm text-body-sm text-text-primary hover:border-primary">{d.roles[r]}</Link></li>
            ))}
          </ul>
        </div>
      </aside>

      <div className="lg:pl-[272px]">
        {/* One sticky bar on every staff screen: where I work (context) on the left; connection, language and contrast on the right. */}
        <header className="sticky top-0 z-[1000] border-b border-border bg-background">
          <div className="flex min-h-16 items-center gap-sm px-md lg:px-xl">
            <Link to="/" className="inline-flex min-h-12 shrink-0 items-center rounded-md lg:hidden" aria-label={d.layout.pickRole}>
              <Mark className="h-8" />
            </Link>
            <p className="min-w-0 truncate text-body-md font-bold text-text-primary lg:hidden">{roleName}</p>
            {context && <div className="hidden min-w-0 lg:block">{context}</div>}
            <div className="ml-auto flex shrink-0 items-center gap-sm">
              <SyncStatus />
              <LangSwitch />
              <A11yToggles only={['highContrast']} />
            </div>
          </div>
          {context && <div className="border-t border-border px-md py-sm lg:hidden">{context}</div>}
        </header>
        <EmergencyStrip />
        <main id="main" ref={main} tabIndex={-1} className="mx-auto max-w-[1440px] px-md pb-[96px] pt-lg outline-none lg:px-xl lg:pb-2xl">
          {showAlerts && <Alerts />}
          <Outlet />
        </main>
      </div>
      <BottomNav items={items} label={roleName} />
    </div>
  )
}
