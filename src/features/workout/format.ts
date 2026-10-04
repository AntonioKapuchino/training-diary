import { formatClock, formatNumber } from '@/domain/format'
import type { ExerciseKind, SetField } from '@/domain/types'
import type { Hint } from './hints'

/** Значение ячейки: «62,5», «8», «1:30». */
export function formatCell(field: SetField, v: number | undefined): string {
  if (v === undefined) return ''
  if (field === 'seconds') return formatClock(v)
  return formatNumber(v)
}

/** Колонка «Прошлый раз»: «60 × 8», «+5 × 10», «1:30», «20:00 · 3 км». */
export function formatHint(kind: ExerciseKind, h: Hint | undefined): string {
  if (!h) return '—'
  switch (kind) {
    case 'strength':
      return h.reps ? `${formatNumber(h.weight ?? 0)} × ${h.reps}` : formatNumber(h.weight ?? 0)
    case 'bodyweight':
      return h.weight ? `+${formatNumber(h.weight)} × ${h.reps ?? 0}` : `${h.reps ?? 0}`
    case 'timed':
      return formatClock(h.seconds ?? 0)
    case 'cardio': {
      const parts = []
      if (h.seconds) parts.push(formatClock(h.seconds))
      if (h.distance) parts.push(`${formatNumber(h.distance)} км`)
      return parts.join(' · ') || '—'
    }
  }
}
