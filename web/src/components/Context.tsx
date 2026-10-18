// Work-context pickers shown in the staff top bar. Free choice in demo mode; locked to the signed-in account in supabase mode.
import { CloudOff, Wifi } from 'lucide-react'
import { useId } from 'react'
import { volunteers } from '../data/mock'
import { useT } from '../i18n'
import { dataMode } from '../state/remote'
import { useStore } from '../state/store'
import { usePersona } from './domain'

const selectCls = 'min-h-12 min-w-0 max-w-full rounded-md border border-text-muted bg-background px-sm text-body-md font-semibold text-text-primary'

export function ShelterContext() {
  const d = useT()
  const { state } = useStore()
  const [id, setId] = usePersona('shelter')
  const fid = useId()
  return (
    <div className="flex min-w-0 items-center gap-sm">
      <label htmlFor={fid} className="shrink-0 text-body-sm text-text-secondary">{d.layout.workAt}</label>
      <select id={fid} value={id} disabled={dataMode === 'supabase'} onChange={(e) => setId(e.target.value)} className={`${selectCls} flex-1 lg:w-[360px] lg:flex-none`}>
        {state.shelters.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
    </div>
  )
}

export function VolunteerContext() {
  const d = useT()
  const { state, dispatch } = useStore()
  const [id, setId] = usePersona('volunteer')
  const fid = useId()
  const v = volunteers.find((x) => x.id === id) ?? volunteers[0]
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-sm">
      <label htmlFor={fid} className="shrink-0 text-body-sm text-text-secondary">{d.layout.me}</label>
      <select id={fid} value={v.id} disabled={dataMode === 'supabase'} onChange={(e) => setId(e.target.value)} className={`${selectCls} min-w-[200px] flex-1 lg:w-[300px] lg:flex-none`}>
        {volunteers.map((x) => <option key={x.id} value={x.id}>{x.name} — {d.vehicle[x.vehicleType]}</option>)}
      </select>
      <button
        type="button"
        aria-pressed={state.offline}
        onClick={() => dispatch({ type: 'set_offline', offline: !state.offline })}
        className={`pressable inline-flex min-h-12 grow cursor-pointer items-center justify-center gap-xs rounded-md border px-md text-body-sm font-semibold sm:grow-0 ${state.offline ? 'border-status-recommended bg-tint-recommended text-status-recommended' : 'border-text-muted bg-background text-text-primary hover:bg-surface-subtle'}`}
      >
        {state.offline ? <Wifi aria-hidden className="h-5 w-5" /> : <CloudOff aria-hidden className="h-5 w-5" />}
        {state.offline ? d.layout.restoreSignal : d.layout.simulateOffline}
      </button>
    </div>
  )
}
