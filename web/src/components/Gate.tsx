// SEC-2: in supabase mode each area needs an account with that role. Demo mode has no accounts and passes through.
import { LogIn, LogOut } from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'
import { demoAccounts } from '../config'
import { useT } from '../i18n'
import { dataMode, supabase } from '../state/remote'
import { useStore } from '../state/store'
import type { Role } from '../types'
import { Logo } from './Layout'
import { Button, Card, TextInput } from './ui'

const roleKey = { citizen: 'citizen', coordinator: 'coordinator', shelter_manager: 'shelter', volunteer: 'field' } as const

export function Gate({ role, children }: { role: Role; children: ReactNode }) {
  const d = useT()
  const { profile } = useStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  if (dataMode === 'demo' || profile?.role === role) return children
  if (profile === undefined) return null // still loading the session
  const name = d.roles[roleKey[role]]
  const signIn = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setFailed(false)
    // shortcut: any email/password is accepted and signs in to this page's role account; replace with real accounts (auth) before launch.
    const { error } = await supabase!.auth.signInWithPassword({ email: demoAccounts[role], password: demoAccounts.password })
    setBusy(false)
    setFailed(!!error)
  }
  return (
    <main id="main" className="flex min-h-dvh items-center justify-center bg-surface px-md">
      <Card className="w-full max-w-[440px]">
        <form onSubmit={signIn} className="flex flex-col gap-md">
          <Logo className="h-8 self-start" />
          <div>
            <h1 className="text-h2 text-text-primary">{d.auth.title}</h1>
            <p className="mt-xs text-body-md text-text-secondary">{d.auth.body(name)}</p>
          </div>
          <TextInput label={d.auth.email} type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <TextInput label={d.auth.password} type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          <Button type="submit" size="lg" block icon={LogIn} disabled={busy}>{d.auth.submit}</Button>
          {failed && <p role="alert" className="text-body-sm text-accent-emergency">{d.auth.failed}</p>}
        </form>
      </Card>
    </main>
  )
}

/** Signs out and clears this device's copy of the data (shared phones at a shelter). */
export function SignOut() {
  const d = useT()
  if (dataMode === 'demo') return null
  // Icon-only on phones so the header still fits at 360px; the label stays available to screen readers.
  return (
    <button type="button" onClick={() => void supabase!.auth.signOut()} className="pressable inline-flex min-h-12 min-w-12 shrink-0 cursor-pointer items-center justify-center gap-xs rounded-md border border-text-muted bg-background px-sm text-body-sm font-semibold text-text-primary hover:bg-surface-subtle">
      <LogOut aria-hidden className="h-5 w-5" />
      <span className="sr-only sm:not-sr-only">{d.auth.signOut}</span>
    </button>
  )
}
