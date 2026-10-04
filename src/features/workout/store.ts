import { useSyncExternalStore } from 'react'
import type { SetField } from '@/domain/types'

export interface KeypadTarget {
  entryId: string
  setId: string
  field: SetField
}

export interface RestState {
  startedAt: number
  endsAt: number
  total: number
  /** Отдых кончился — капсула подсвечивается несколько секунд. */
  finished: boolean
}

interface State {
  /** Экран тренировки развёрнут (иначе — капсула над таб-баром). */
  expanded: boolean
  keypad: KeypadTarget | null
  /** Первое нажатие на клавиатуре заменяет значение, а не дописывает. */
  fresh: boolean
  /** Черновик ввода активной ячейки: «52,» ещё не число, но показать его надо. */
  draft: string | null
  rest: RestState | null
  /** id только что завершённой тренировки — показать итоги. */
  summary: string | null
}

/*
 * Открыт ли экран тренировки и идёт ли отдых — переживает перезагрузку:
 * iOS выгружает приложение из памяти, а обновление перезагружает страницу.
 */
const KEY = 'td:workout-ui'

function isRest(x: unknown): x is RestState {
  if (typeof x !== 'object' || x === null) return false
  const r = x as Record<string, unknown>
  return (
    typeof r.startedAt === 'number' && typeof r.endsAt === 'number' && typeof r.total === 'number'
  )
}

function restore(): Pick<State, 'expanded' | 'rest'> {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? '{}') as {
      expanded?: unknown
      rest?: unknown
    }
    const rest =
      isRest(saved.rest) && saved.rest.endsAt > Date.now()
        ? { ...saved.rest, finished: false }
        : null
    return { expanded: saved.expanded === true, rest }
  } catch {
    return { expanded: false, rest: null }
  }
}

function save(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ expanded: state.expanded, rest: state.rest }))
  } catch {
    // Без хранилища просто не восстановимся после перезагрузки.
  }
}

let state: State = {
  keypad: null,
  fresh: true,
  draft: null,
  summary: null,
  ...restore(),
}
const listeners = new Set<() => void>()

function set(patch: Partial<State>): void {
  state = { ...state, ...patch }
  if ('expanded' in patch || 'rest' in patch) save()
  for (const l of listeners) l()
}

export function getWorkoutUi(): State {
  return state
}

export function useWorkoutUi(): State {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => state,
    () => state,
  )
}

export const workoutUi = {
  open: () => {
    set({ expanded: true })
  },
  minimize: () => {
    set({ expanded: false, keypad: null, draft: null })
  },
  focus: (keypad: KeypadTarget) => {
    set({ keypad, fresh: true, draft: null })
  },
  typed: (draft: string) => {
    set({ fresh: false, draft })
  },
  /** Значение задано кнопкой «−»/«+»: следующая цифра снова заменит его целиком. */
  retype: (draft: string) => {
    set({ fresh: true, draft })
  },
  closeKeypad: () => {
    set({ keypad: null, draft: null })
  },
  startRest: (seconds: number) => {
    const now = Date.now()
    set({ rest: { startedAt: now, endsAt: now + seconds * 1000, total: seconds, finished: false } })
  },
  adjustRest: (deltaSec: number) => {
    const r = state.rest
    if (!r) return
    const endsAt = Math.max(Date.now() + 1000, r.endsAt + deltaSec * 1000)
    set({ rest: { ...r, endsAt, total: Math.max(1, r.total + deltaSec), finished: false } })
  },
  finishRest: () => {
    if (state.rest) set({ rest: { ...state.rest, finished: true } })
  },
  stopRest: () => {
    set({ rest: null })
  },
  showSummary: (workoutId: string) => {
    set({ summary: workoutId, expanded: false, keypad: null, rest: null })
  },
  closeSummary: () => {
    set({ summary: null })
  },
}
