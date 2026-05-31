import type { ExerciseKind, SetEntry, ProgressPoint } from '../db/types'

/* ---------- Колонки ввода в подходе ---------- */

export interface SetColumn {
  label: string
  step?: number
  /** целое (повторы, мин, сек) или дробное (вес, км) */
  decimal?: boolean
  get: (s: SetEntry) => number | undefined
  apply: (s: SetEntry, v: number) => Partial<SetEntry>
}

const mins = (s: SetEntry) => Math.floor((s.seconds ?? 0) / 60)
const secs = (s: SetEntry) => (s.seconds ?? 0) % 60

export function columnsFor(kind: ExerciseKind): SetColumn[] {
  switch (kind) {
    case 'strength':
      return [
        { label: 'повт', get: (s) => s.reps, apply: (_s, v) => ({ reps: v }) },
        { label: 'кг', step: 0.5, decimal: true, get: (s) => s.weight, apply: (_s, v) => ({ weight: v }) },
      ]
    case 'bodyweight':
      return [
        { label: 'повт', get: (s) => s.reps, apply: (_s, v) => ({ reps: v }) },
        { label: '+кг', step: 0.5, decimal: true, get: (s) => s.weight, apply: (_s, v) => ({ weight: v }) },
      ]
    case 'timed':
      return [
        { label: 'мин', get: (s) => mins(s), apply: (s, v) => ({ seconds: v * 60 + secs(s) }) },
        { label: 'сек', get: (s) => secs(s), apply: (s, v) => ({ seconds: mins(s) * 60 + Math.min(59, v) }) },
      ]
    case 'cardio':
      return [
        { label: 'мин', get: (s) => Math.round((s.seconds ?? 0) / 60), apply: (_s, v) => ({ seconds: v * 60 }) },
        { label: 'км', step: 0.1, decimal: true, get: (s) => s.distance, apply: (_s, v) => ({ distance: v }) },
      ]
  }
}

export function defaultSet(kind: ExerciseKind): SetEntry {
  switch (kind) {
    case 'strength': return { reps: 10, weight: 0 }
    case 'bodyweight': return { reps: 10, weight: 0 }
    case 'timed': return { seconds: 60 }
    case 'cardio': return { seconds: 600, distance: 0 }
  }
}

/* ---------- Форматирование ---------- */

export function formatDuration(totalSec: number): string {
  const sec = Math.max(0, Math.round(totalSec))
  const m = Math.floor(sec / 60)
  const s = sec % 60
  if (m === 0) return `${s} сек`
  return `${m}:${String(s).padStart(2, '0')}`
}

function round(n: number): number {
  return Math.round(n * 10) / 10
}

const sum = (sets: SetEntry[], pick: (s: SetEntry) => number) =>
  sets.reduce((acc, s) => acc + (pick(s) || 0), 0)
const max = (sets: SetEntry[], pick: (s: SetEntry) => number) =>
  sets.reduce((acc, s) => Math.max(acc, pick(s) || 0), 0)

/** Короткая сводка под названием упражнения. */
export function summaryFor(kind: ExerciseKind, sets: SetEntry[]): string {
  const n = sets.length
  const podh = `${n} ${plural(n, 'подход', 'подхода', 'подходов')}`
  switch (kind) {
    case 'strength': {
      const vol = sum(sets, (s) => (s.reps || 0) * (s.weight || 0))
      return vol > 0 ? `${podh} · ${round(vol).toLocaleString('ru')} кг` : podh
    }
    case 'bodyweight': {
      const reps = sum(sets, (s) => s.reps || 0)
      const addW = max(sets, (s) => s.weight || 0)
      const base = `${podh} · ${reps} повт`
      return addW > 0 ? `${base} · +${round(addW)} кг` : base
    }
    case 'timed': {
      const total = sum(sets, (s) => s.seconds || 0)
      return `${podh} · ${formatDuration(total)}`
    }
    case 'cardio': {
      const total = sum(sets, (s) => s.seconds || 0)
      const dist = sum(sets, (s) => s.distance || 0)
      const t = formatDuration(total)
      return dist > 0 ? `${t} · ${round(dist)} км` : t
    }
  }
}

/** Только силовой объём в кг (для итога по тренировке и карточек дневника). */
export function strengthVolume(kind: ExerciseKind, sets: SetEntry[]): number {
  if (kind !== 'strength') return 0
  return sum(sets, (s) => (s.reps || 0) * (s.weight || 0))
}

/* ---------- Метрики прогресса ---------- */

export interface ProgMetric {
  key: string
  label: string
  /** значение для графика */
  value: (p: ProgressPoint) => number
  /** как показать в подписи/статистике */
  format: (n: number) => string
}

export function progMetrics(kind: ExerciseKind): ProgMetric[] {
  const kg = (n: number) => `${round(n)} кг`
  const reps = (n: number) => `${Math.round(n)} повт`
  const km = (n: number) => `${round(n)} км`
  switch (kind) {
    case 'strength':
      return [
        { key: 'maxWeight', label: 'Макс. вес', value: (p) => p.maxWeight, format: kg },
        { key: 'volume', label: 'Объём', value: (p) => Math.round(p.totalVolume), format: kg },
      ]
    case 'bodyweight':
      return [
        { key: 'maxReps', label: 'Макс. повторы', value: (p) => p.maxReps, format: reps },
        { key: 'totalReps', label: 'Сумма повторов', value: (p) => p.totalReps, format: reps },
      ]
    case 'timed':
      return [
        { key: 'maxSeconds', label: 'Лучшее время', value: (p) => p.maxSeconds, format: formatDuration },
        { key: 'totalSeconds', label: 'Суммарно', value: (p) => p.totalSeconds, format: formatDuration },
      ]
    case 'cardio':
      return [
        { key: 'maxDistance', label: 'Дистанция', value: (p) => p.maxDistance, format: km },
        { key: 'totalSeconds', label: 'Время', value: (p) => p.totalSeconds, format: formatDuration },
      ]
  }
}

/** Строка истории под датой на экране прогресса. */
export function historyLine(kind: ExerciseKind, p: ProgressPoint): string {
  switch (kind) {
    case 'strength':
      return `макс ${round(p.maxWeight)} кг · объём ${Math.round(p.totalVolume).toLocaleString('ru')} кг`
    case 'bodyweight':
      return `макс ${p.maxReps} повт · всего ${p.totalReps} повт`
    case 'timed':
      return `лучшее ${formatDuration(p.maxSeconds)} · суммарно ${formatDuration(p.totalSeconds)}`
    case 'cardio':
      return `${round(p.totalDistance)} км · ${formatDuration(p.totalSeconds)}`
  }
}

export function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10, mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few
  return many
}
