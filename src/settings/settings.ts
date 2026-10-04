import { useSyncExternalStore } from 'react'
import { DEFAULT_PLATES } from '@/domain/plates'

export type ThemePref = 'system' | 'light' | 'dark'
export type Accent = 'indigo' | 'blue' | 'teal' | 'green' | 'orange' | 'red' | 'pink' | 'purple'
/** Таймер отдыха: выключен, тихий отсчёт или отсчёт со звуком в конце. */
export type RestTimerMode = 'off' | 'silent' | 'sound'

export interface Settings {
  theme: ThemePref
  accent: Accent
  /** Цель — тренировок в неделю. */
  weeklyGoal: number
  restTimer: RestTimerMode
  /** Отдых по умолчанию, секунды. */
  restSec: number
  /** Шаг кнопок «−» и «+» для веса, кг. */
  weightStep: number
  barWeight: number
  plates: number[]
  /** Не гасить экран, пока идёт тренировка. */
  keepAwake: boolean
  /** Напоминать о резервной копии через столько дней; 0 — не напоминать. */
  backupReminderDays: number
}

export const ACCENTS: readonly Accent[] = [
  'indigo',
  'blue',
  'teal',
  'green',
  'orange',
  'red',
  'pink',
  'purple',
]

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  accent: 'indigo',
  weeklyGoal: 3,
  restTimer: 'silent',
  restSec: 90,
  weightStep: 2.5,
  barWeight: 20,
  plates: [...DEFAULT_PLATES],
  keepAwake: true,
  backupReminderDays: 14,
}

const KEY = 'td:settings'

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))
const pickNum = (x: unknown, lo: number, hi: number, fallback: number) =>
  typeof x === 'number' && Number.isFinite(x) ? clamp(x, lo, hi) : fallback

/** Настройки из хранилища или файла: всё непонятное заменяется значениями по умолчанию. */
export function sanitizeSettings(x: unknown): Settings {
  const o = typeof x === 'object' && x !== null ? (x as Record<string, unknown>) : {}
  const d = DEFAULT_SETTINGS
  const plates = Array.isArray(o.plates)
    ? o.plates.filter((p): p is number => typeof p === 'number' && p > 0 && p <= 50)
    : []
  return {
    theme: o.theme === 'light' || o.theme === 'dark' || o.theme === 'system' ? o.theme : d.theme,
    accent: ACCENTS.includes(o.accent as Accent) ? (o.accent as Accent) : d.accent,
    weeklyGoal: Math.round(pickNum(o.weeklyGoal, 1, 7, d.weeklyGoal)),
    restTimer:
      o.restTimer === 'off' || o.restTimer === 'sound' || o.restTimer === 'silent'
        ? o.restTimer
        : d.restTimer,
    restSec: Math.round(pickNum(o.restSec, 15, 600, d.restSec)),
    weightStep: pickNum(o.weightStep, 0.25, 10, d.weightStep),
    barWeight: pickNum(o.barWeight, 0, 50, d.barWeight),
    plates: plates.length > 0 ? [...new Set(plates)].sort((a, b) => b - a) : [...d.plates],
    keepAwake: typeof o.keepAwake === 'boolean' ? o.keepAwake : d.keepAwake,
    backupReminderDays: Math.round(pickNum(o.backupReminderDays, 0, 90, d.backupReminderDays)),
  }
}

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY)
    return sanitizeSettings(raw ? JSON.parse(raw) : {})
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

let current: Settings = load()
const listeners = new Set<() => void>()

export function getSettings(): Settings {
  return current
}

export function updateSettings(patch: Partial<Settings>): void {
  current = sanitizeSettings({ ...current, ...patch })
  try {
    localStorage.setItem(KEY, JSON.stringify(current))
  } catch {
    // Приватный режим или переполнение — настройки живут до перезагрузки.
  }
  applyAppearance(current)
  for (const l of listeners) l()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useSettings(): Settings {
  return useSyncExternalStore(subscribe, getSettings, getSettings)
}

const darkQuery = () =>
  typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : undefined

export function resolvedTheme(s: Settings): 'light' | 'dark' {
  if (s.theme !== 'system') return s.theme
  return darkQuery()?.matches ? 'dark' : 'light'
}

/** Тема и акцент — атрибуты на <html>, цвета берутся из CSS-переменных. */
export function applyAppearance(s: Settings): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  const theme = resolvedTheme(s)
  root.dataset.theme = theme
  root.dataset.accent = s.accent
  for (const m of document.querySelectorAll('meta[name="theme-color"]')) m.remove()
  const meta = document.createElement('meta')
  meta.name = 'theme-color'
  meta.content = theme === 'dark' ? '#000000' : '#f2f2f7'
  document.head.append(meta)
}

/** Следит за системной темой, если выбрана «как в системе». */
export function initAppearance(): void {
  applyAppearance(current)
  darkQuery()?.addEventListener('change', () => {
    if (current.theme === 'system') applyAppearance(current)
  })
}
