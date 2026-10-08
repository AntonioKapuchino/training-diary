import { addDays, dateOf, startOfWeek } from './dates'
import { estimate1RM } from './records'
import { counts, setVolume } from './sets'
import type { ExerciseKind, MuscleGroup, WorkoutSet, WorkoutSummary } from './types'

/** Упражнение тренировки вместе с тем, что о нём нужно знать для подсчётов. */
export interface EntryFacts {
  kind: ExerciseKind
  muscle: MuscleGroup
  sets: readonly WorkoutSet[]
}

export function summarize(entries: readonly EntryFacts[], records = 0): WorkoutSummary {
  let sets = 0
  let volume = 0
  let reps = 0
  let exercises = 0
  const perMuscle = new Map<MuscleGroup, number>()
  for (const e of entries) {
    let done = 0
    for (const s of e.sets) {
      if (!counts(e.kind, s)) continue
      done++
      volume += setVolume(e.kind, s)
      if (e.kind === 'strength' || e.kind === 'bodyweight') reps += s.reps ?? 0
    }
    if (done > 0) {
      exercises++
      sets += done
      perMuscle.set(e.muscle, (perMuscle.get(e.muscle) ?? 0) + done)
    }
  }
  const muscles = [...perMuscle.entries()].sort((a, b) => b[1] - a[1]).map(([m]) => m)
  return { exercises, sets, volume, reps, muscles, records }
}

/** Подходы на каждую группу мышц — для баланса нагрузки. */
export function muscleSetCounts(entries: readonly EntryFacts[]): Map<MuscleGroup, number> {
  const out = new Map<MuscleGroup, number>()
  for (const e of entries) {
    const n = e.sets.filter((s) => counts(e.kind, s)).length
    if (n > 0) out.set(e.muscle, (out.get(e.muscle) ?? 0) + n)
  }
  return out
}

export interface WorkoutFacts {
  date: string
  startedAt: number
  finishedAt?: number | undefined
  summary?: WorkoutSummary | undefined
}

export interface WeekBucket {
  /** Понедельник недели. */
  week: string
  workouts: number
  volume: number
  sets: number
  /** Суммарное время тренировок, секунды. */
  seconds: number
}

/** Итоги по неделям: `weeks` недель, последняя — та, что содержит `endDate`. */
export function weeklyBuckets(
  workouts: readonly WorkoutFacts[],
  endDate: string,
  weeks: number,
): WeekBucket[] {
  const last = startOfWeek(endDate)
  const buckets = Array.from({ length: weeks }, (_, i) => ({
    week: addDays(last, (i - weeks + 1) * 7),
    workouts: 0,
    volume: 0,
    sets: 0,
    seconds: 0,
  }))
  const index = new Map(buckets.map((b, i) => [b.week, i]))
  for (const w of workouts) {
    const i = index.get(startOfWeek(w.date))
    if (i === undefined) continue
    const b = buckets[i]
    if (!b) continue
    b.workouts++
    b.volume += w.summary?.volume ?? 0
    b.sets += w.summary?.sets ?? 0
    b.seconds += workoutSeconds(w)
  }
  return buckets
}

/** Длительность в секундах; 0 — неизвестна (у тренировок из старой версии её нет). */
export function workoutSeconds(w: { startedAt: number; finishedAt?: number | undefined }): number {
  if (w.finishedAt === undefined) return 0
  const sec = Math.round((w.finishedAt - w.startedAt) / 1000)
  return sec >= 60 ? sec : 0
}

/**
 * Сколько недель подряд выполнена цель «N тренировок в неделю». `dates` — по дате
 * на тренировку: две в один день — две, как и в кольце недели.
 * Текущая неделя засчитывается, если цель уже выполнена; если ещё нет — серия
 * не прерывается, пока неделя не кончилась.
 */
export function streakWeeks(dates: readonly string[], goal: number, today: string): number {
  if (goal <= 0) return 0
  const perWeek = new Map<string, number>()
  for (const d of dates) {
    const w = startOfWeek(d)
    perWeek.set(w, (perWeek.get(w) ?? 0) + 1)
  }
  let week = startOfWeek(today)
  let streak = 0
  if ((perWeek.get(week) ?? 0) >= goal) streak++
  week = addDays(week, -7)
  while ((perWeek.get(week) ?? 0) >= goal) {
    streak++
    week = addDays(week, -7)
  }
  return streak
}

/** Итоги упражнения за одну тренировку — точка графика прогресса. */
export interface SessionPoint {
  workoutId: string
  startedAt: number
  date: string
  /** Лучший расчётный максимум, кг. */
  e1rm: number
  /** Максимальный вес (для своего веса — отягощение), кг. */
  weight: number
  volume: number
  /** Больше всего повторов в одном подходе. */
  reps: number
  totalReps: number
  /** Самый долгий подход, секунды. */
  duration: number
  totalDuration: number
  distance: number
  /** Средний темп за тренировку, секунды на км; 0 — нет данных. */
  pace: number
  sets: number
}

export function sessionPoint(
  kind: ExerciseKind,
  workoutId: string,
  startedAt: number,
  sets: readonly WorkoutSet[],
): SessionPoint | null {
  const p: SessionPoint = {
    workoutId,
    startedAt,
    date: dateOf(startedAt),
    e1rm: 0,
    weight: 0,
    volume: 0,
    reps: 0,
    totalReps: 0,
    duration: 0,
    totalDuration: 0,
    distance: 0,
    pace: 0,
    sets: 0,
  }
  // Темп — только по подходам, где есть и время, и дистанция: заминка без дистанции
  // не должна делать пробежку медленнее.
  let paceSec = 0
  let paceKm = 0
  for (const s of sets) {
    if (!counts(kind, s)) continue
    p.sets++
    const w = s.weight ?? 0
    const r = s.reps ?? 0
    const sec = s.seconds ?? 0
    const km = s.distance ?? 0
    p.weight = Math.max(p.weight, w)
    p.e1rm = Math.max(p.e1rm, kind === 'strength' ? estimate1RM(w, r) : 0)
    p.volume += setVolume(kind, s)
    p.reps = Math.max(p.reps, r)
    p.totalReps += r
    p.duration = Math.max(p.duration, sec)
    p.totalDuration += sec
    p.distance += km
    if (sec > 0 && km > 0) {
      paceSec += sec
      paceKm += km
    }
  }
  if (p.sets === 0) return null
  if (kind === 'cardio' && paceKm >= 0.5) p.pace = paceSec / paceKm
  return p
}

export type MetricKey =
  | 'e1rm'
  | 'weight'
  | 'volume'
  | 'reps'
  | 'totalReps'
  | 'duration'
  | 'totalDuration'
  | 'distance'
  | 'pace'

export interface MetricDef {
  key: MetricKey
  label: string
  /** Меньше — лучше (темп). */
  lowerIsBetter?: boolean
}

export const METRICS: Record<ExerciseKind, readonly MetricDef[]> = {
  strength: [
    { key: 'e1rm', label: 'Максимум' },
    { key: 'weight', label: 'Вес' },
    { key: 'volume', label: 'Объём' },
  ],
  bodyweight: [
    { key: 'reps', label: 'Повторы' },
    { key: 'totalReps', label: 'Всего' },
    { key: 'weight', label: 'Отягощение' },
  ],
  timed: [
    { key: 'duration', label: 'Лучшее' },
    { key: 'totalDuration', label: 'Всего' },
  ],
  cardio: [
    { key: 'distance', label: 'Дистанция' },
    { key: 'totalDuration', label: 'Время' },
    { key: 'pace', label: 'Темп', lowerIsBetter: true },
  ],
}
