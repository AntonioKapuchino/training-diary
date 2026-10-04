import { formatClock, parseDecimal, roundTo } from '@/domain/format'
import type { FieldSpec } from '@/domain/sets'

export type Key = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | ',' | 'back'

const MAX_INT_DIGITS = 4
const MAX_TIME_DIGITS = 6

/** Черновик из сохранённого значения: «62.5», а для времени — цифры «130» для 1:30. */
export function draftOf(spec: FieldSpec, value: number | undefined): string {
  if (value === undefined || value === 0) return ''
  if (spec.duration) {
    const h = Math.floor(value / 3600)
    const m = Math.floor((value % 3600) / 60)
    const s = value % 60
    const digits =
      h > 0
        ? `${h}${String(m).padStart(2, '0')}${String(s).padStart(2, '0')}`
        : `${m}${String(s).padStart(2, '0')}`
    return digits.replace(/^0+/, '')
  }
  return String(value)
}

/** Нажатие клавиши: новый черновик. fresh — первое нажатие заменяет значение целиком. */
export function pressKey(spec: FieldSpec, draft: string, key: Key, fresh: boolean): string {
  if (spec.duration) {
    if (key === ',') return draft
    if (key === 'back') return fresh ? '' : draft.slice(0, -1)
    const next = (fresh ? '' : draft) + key
    const trimmed = next.replace(/^0+/, '')
    return trimmed.length > MAX_TIME_DIGITS ? draft : trimmed
  }
  if (key === 'back') return fresh ? '' : draft.slice(0, -1)
  const base = fresh ? '' : draft
  if (key === ',') {
    if (spec.decimals === 0 || base.includes('.')) return base
    return base === '' ? '0.' : `${base}.`
  }
  const [int = '', frac] = base.split('.')
  if (frac !== undefined) {
    return frac.length >= spec.decimals ? base : base + key
  }
  if (int === '0') return key
  return int.length >= MAX_INT_DIGITS ? base : base + key
}

/** Значение из черновика: пусто — undefined (ячейка снова показывает подсказку). */
export function valueOf(spec: FieldSpec, draft: string): number | undefined {
  if (draft === '') return undefined
  if (spec.duration) {
    const d = draft.padStart(6, '0')
    const h = Number(d.slice(0, 2))
    const m = Number(d.slice(2, 4))
    const s = Number(d.slice(4, 6))
    const total = h * 3600 + m * 60 + s
    return total > 0 ? total : undefined
  }
  const n = parseDecimal(draft)
  return n !== undefined && n > 0 ? n : n === 0 ? 0 : undefined
}

/** Черновик для показа в ячейке: «62,5», «52,» во время ввода, «1:30» для времени. */
export function displayDraft(spec: FieldSpec, draft: string): string {
  if (spec.duration) {
    const v = valueOf(spec, draft) ?? 0
    return formatClock(v)
  }
  return draft.replace('.', ',')
}

/** «−» и «+»: от текущего значения, а если пусто — от подсказки. */
export function stepValue(
  current: number | undefined,
  hint: number | undefined,
  step: number,
  dir: 1 | -1,
): number {
  const base = current ?? hint ?? 0
  const next = roundTo(base + dir * step, step)
  return Math.max(0, next)
}
