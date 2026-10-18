// SEC-2: in supabase mode each area needs an account with that role. Demo mode has no accounts and passes through.
import { LogIn } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { demoAccounts } from '../config'
import { useT } from '../i18n'
import { dataMode, supabase } from '../state/remote'
import { useStore } from '../state/store'
import type { Role } from '../types'
import { Logo } from './Layout'
import { Button, Card } from './ui'

const roleKey = { citizen: 'citizen', coordinator: 'coordinator', shelter_manager: 'shelter', volunteer: 'field' } as const

export function Gate({ role, children }: { role: Role; children: ReactNode }) {
  const d = useT()
  const { profile } = useStore()
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  if (dataMode === 'demo' || profile?.role === role) return children
  if (profile === undefined) return null // still loading the session
  const name = d.roles[roleKey[role]]
  const signIn = async () => {
    setBusy(true)
    setFailed(false)
    // Switching role = signing in as that role's demo account (replaces the current session).
    const { error } = await supabase!.auth.signInWithPassword({ email: demoAccounts[role], password: demoAccounts.password })
    setBusy(false)
    setFailed(!!error)
  }
  return (
    <main id="main" className="flex min-h-dvh items-center justify-center bg-surface px-md">
      <Card className="flex w-full max-w-[440px] flex-col gap-md">
        <Logo className="h-8 self-start" />
        <h1 className="text-h2 text-text-primary">{d.auth.title}</h1>
        <p className="text-body-md text-text-secondary">{d.auth.body(name)}</p>
        <Button size="lg" block icon={LogIn} disabled={busy} onClick={signIn}>{d.auth.demo(name)}</Button>
        {failed && <p role="alert" className="text-body-sm text-accent-emergency">{d.auth.failed}</p>}
      </Card>
    </main>
  )
}
