import { ArrowRight, Building2, Check, CircleCheckBig, ClipboardList, HeartHandshake, RadioTower, Shuffle, ShieldCheck, Truck, type LucideIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import { A11yToggles, LangSwitch, Logo } from '../components/Layout'
import { Button, IconChip, buttonCls, type Tone } from '../components/ui'
import { useT } from '../i18n'
import { dataMode } from '../state/remote'
import { useStore } from '../state/store'

const flowIcons: { icon: LucideIcon; tone: Tone }[] = [
  { icon: ClipboardList, tone: 'blue' },
  { icon: Shuffle, tone: 'indigo' },
  { icon: ShieldCheck, tone: 'green' },
  { icon: Truck, tone: 'amber' },
  { icon: CircleCheckBig, tone: 'green' },
]

/** Static, decorative preview of the resident screen (real components live under /warga). */
function PhonePreview() {
  const d = useT()
  return (
    <div role="img" aria-label={d.home.previewLabel} className="mx-auto w-[300px] rounded-[36px] border-[10px] border-text-primary bg-surface">
      <div aria-hidden className="overflow-hidden rounded-[26px]">
        <div className="flex h-11 items-center justify-between bg-background px-md">
          <Logo className="h-5" />
          <span className="rounded-md bg-accent-emergency px-xs text-caption font-bold text-text-on-primary">112</span>
        </div>
        <div className="bg-primary px-md pb-xl pt-md text-text-on-primary">
          <p className="text-caption">{d.warga.hello}</p>
          <p className="text-h3">Keluarga Siregar</p>
        </div>
        <div className="-mt-lg px-sm pb-md">
          <div className="rounded-lg border-2 border-status-confirmed bg-tint-confirmed p-sm">
            <div className="flex items-center gap-sm">
              <IconChip icon={ShieldCheck} tone="blue" size={36} solid />
              <p className="text-body-md font-bold leading-tight text-text-primary">{d.warga.hero.readyTitle}</p>
            </div>
            <span className="mt-sm flex h-10 items-center justify-center gap-xs rounded-md bg-primary text-body-sm font-semibold text-text-on-primary">
              <Check className="h-4 w-4" />{d.warga.hero.readyAction}
            </span>
          </div>
          <ol className="mt-sm flex flex-col gap-xs rounded-lg border border-border bg-background p-sm">
            {d.warga.journey.map((j, i) => (
              <li key={j} className="flex items-center gap-sm text-caption">
                <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full ${i < 2 ? 'bg-primary text-text-on-primary' : 'border border-text-muted text-text-secondary'}`}>
                  {i < 2 ? <Check className="h-3 w-3" strokeWidth={3} /> : i + 1}
                </span>
                <span className={i < 2 ? 'font-semibold text-text-primary' : 'text-text-secondary'}>{j}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  )
}

export default function Home() {
  const d = useT()
  const { dispatch } = useStore()
  const staff: { to: string; title: string; does: string; icon: LucideIcon; tone: Tone }[] = [
    { to: '/koordinator', title: d.roles.coordinator, does: d.home.staff.coordinator, icon: RadioTower, tone: 'red' },
    { to: '/posko', title: d.roles.shelter, does: d.home.staff.shelter, icon: Building2, tone: 'blue' },
    { to: '/relawan', title: d.roles.field, does: d.home.staff.field, icon: Truck, tone: 'indigo' },
  ]
  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-[1000] border-b border-border bg-background">
        <div className="mx-auto flex h-16 max-w-[1180px] items-center gap-sm px-md">
          <Logo className="mr-auto h-7 sm:h-8" />
          <LangSwitch />
          <A11yToggles only={['highContrast']} />
        </div>
      </header>

      <main id="main">
        <section className="border-b border-border bg-surface">
          <div className="mx-auto grid max-w-[1180px] items-center gap-xl px-md py-xl lg:grid-cols-[1.25fr_1fr] lg:py-2xl">
            <div className="enter">
              <p className="inline-flex rounded-full bg-tint-confirmed px-md py-xs text-body-sm font-semibold text-status-confirmed">{d.home.eyebrow}</p>
              <h1 className="mt-md text-[2rem] font-bold leading-tight tracking-tight text-text-primary lg:text-[2.75rem]">{d.home.title}</h1>
              <p className="mt-md max-w-[600px] text-body-lg text-text-secondary">{d.home.lead}</p>
              <div className="mt-lg flex flex-col gap-sm sm:flex-row">
                <Link to="/warga" className={buttonCls('primary', 'lg') + ' sm:whitespace-nowrap'}>
                  <HeartHandshake aria-hidden className="h-6 w-6" />{d.home.ctaCitizen}
                </Link>
                <Link to="/koordinator" className={buttonCls('secondary', 'lg') + ' sm:whitespace-nowrap'}>
                  {d.home.ctaStaff}<ArrowRight aria-hidden className="h-5 w-5" />
                </Link>
              </div>
            </div>
            <div className="hidden lg:block"><PhonePreview /></div>
          </div>
        </section>

        <section aria-labelledby="masalah" className="mx-auto max-w-[1180px] px-md py-xl">
          <h2 id="masalah" className="max-w-[720px] text-h2 text-text-primary">{d.home.problemTitle}</h2>
          <ul className="mt-lg grid gap-md md:grid-cols-3">
            {d.home.stats.map((s) => (
              <li key={s.value} className="rounded-lg border border-border bg-background p-lg">
                <p className="text-[2.25rem] font-bold leading-none tracking-tight text-primary">{s.value}</p>
                <p className="mt-sm text-body-md text-text-primary">{s.label}</p>
                <p className="mt-sm text-caption uppercase text-text-secondary">{s.source}</p>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="cara" className="border-y border-border bg-surface">
          <div className="mx-auto max-w-[1180px] px-md py-xl">
            <h2 id="cara" className="text-h2 text-text-primary">{d.home.howTitle}</h2>
            <ol className="mt-lg grid gap-md sm:grid-cols-2 lg:grid-cols-5">
              {d.home.flow.map((f, i) => (
                <li key={f.title} className="flex flex-col gap-sm rounded-lg border border-border bg-background p-md">
                  <div className="flex items-center justify-between">
                    <IconChip icon={flowIcons[i].icon} tone={flowIcons[i].tone} size={44} />
                    <span aria-hidden className="text-h2 font-bold text-text-muted">{i + 1}</span>
                  </div>
                  <h3 className="text-body-lg font-semibold text-text-primary">{f.title}</h3>
                  <p className="text-body-sm text-text-secondary">{f.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section aria-labelledby="peran" className="mx-auto max-w-[1180px] px-md py-xl">
          <h2 id="peran" className="mb-md text-h2 text-text-primary">{d.home.rolesTitle}</h2>
          <div className="grid gap-md lg:grid-cols-[1.1fr_1fr]">
            <Link to="/warga" className="pressable flex flex-col justify-between gap-lg rounded-lg bg-primary p-lg text-text-on-primary hover:bg-primary-hover">
              <div className="flex items-start gap-md">
                <IconChip icon={HeartHandshake} tone="blue" size={64} solid />
                <div>
                  <h3 className="text-h2">{d.home.citizenCardTitle}</h3>
                  <p className="mt-xs text-body-lg">{d.home.citizenCardBody}</p>
                </div>
              </div>
              <span className="inline-flex min-h-[60px] items-center justify-center gap-sm rounded-md bg-background px-lg text-body-lg font-semibold text-primary">
                {d.home.ctaCitizen}<ArrowRight aria-hidden className="h-6 w-6" />
              </span>
            </Link>
            <div className="flex flex-col gap-sm">
              <h3 className="text-h3 text-text-primary">{d.home.staffTitle}</h3>
              <ul className="flex flex-col gap-sm">
                {staff.map((r) => (
                  <li key={r.to}>
                    <Link to={r.to} className="pressable flex min-h-12 items-center gap-md rounded-lg border border-border bg-background p-md hover:border-primary">
                      <IconChip icon={r.icon} tone={r.tone} size={48} />
                      <span className="flex-1">
                        <span className="block text-body-lg font-semibold text-text-primary">{r.title}</span>
                        <span className="block text-body-sm text-text-secondary">{r.does}</span>
                      </span>
                      <ArrowRight aria-hidden className="h-5 w-5 text-text-secondary" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <footer className="border-t border-border bg-surface">
          <div className="mx-auto flex max-w-[1180px] flex-col gap-md px-md py-lg text-body-sm text-text-secondary md:flex-row md:items-center">
            <p className="flex-1">{dataMode === 'demo' && `${d.home.demoNote} `}{d.home.disclaimer}</p>
            {dataMode === 'demo' && <Button variant="secondary" onClick={() => dispatch({ type: 'reset' })}>{d.home.reset}</Button>}
          </div>
        </footer>
      </main>
    </div>
  )
}
