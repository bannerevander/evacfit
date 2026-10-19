/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DATA_MODE?: 'demo' | 'supabase'
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string
  /** OR-Tools solver service (evacfit/solver); unset = greedy matcher only. */
  readonly VITE_SOLVER_URL?: string
}
