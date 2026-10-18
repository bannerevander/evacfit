import type { Lang } from '../types'

// Set synchronously by StoreProvider on every render, before children render, so formatters always match the UI language.
let current: Lang = 'id'

export function setFormatLang(lang: Lang) {
  current = lang
}

/** en-GB: 24-hour clock and day-first dates, the most widely readable English convention outside the US. */
export const localeTag = () => (current === 'id' ? 'id-ID' : 'en-GB')

export const fmtNum = (n: number, digits = 0) => n.toLocaleString(localeTag(), { minimumFractionDigits: digits, maximumFractionDigits: digits })

export const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString(localeTag(), { hour: '2-digit', minute: '2-digit' })
