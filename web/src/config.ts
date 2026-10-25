// Deployment region settings. Another country = another config, not code changes (BLUEPRINT: "Global lewat konfigurasi").
export const region = {
  country: 'ID',
  /** Single national emergency line shown on every citizen screen. 112 is also the GSM-standard number in most countries. */
  emergencyNumber: '112',
  /** Languages a shelter can serve in. Values are stored codes; display names come from the i18n dictionaries. */
  serviceLanguages: ['Indonesia', 'English', 'BISINDO', 'Batak Toba', 'Karo', 'Mandailing', 'Jawa', 'Minang', 'Sunda', 'Madura', 'Kaili', 'Aceh'],
  /** Demo map centre (Medan). */
  center: { lat: 3.58, lng: 98.68 },
}


/** Public demo accounts (fictional data only), created by supabase/migrations/*_seed.sql. Used by the "Sign in as demo" buttons. */
export const demoAccounts = {
  coordinator: 'koordinator@evacfit.demo',
  shelter_manager: 'posko@evacfit.demo',
  volunteer: 'relawan@evacfit.demo',
  citizen: 'warga@evacfit.demo',
  password: 'EvacFit-Demo-2026',
}
