import { useStore } from '../state/store'
import type { Lang } from '../types'
import { en } from './en'
import { id, type Dict } from './id'

export const dictionaries: Record<Lang, Dict> = { id, en }

/** Current-language dictionary. Values are strings or small formatting functions. */
export function useT(): Dict {
  return dictionaries[useStore().state.lang]
}

export type { Dict }
