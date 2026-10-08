import { addDays, addMonths, startOfMonth, startOfWeek } from './dates'
import { estimate1RM } from './records'
import { counts, setVolume } from './sets'
import { workoutSeconds } from './stats'
import type { Exercise, MuscleGroup, Workout, WorkoutEntry } from './types'

export interface MonthTotals {
  workouts: number
  seconds: number
  volume: number
  sets: number
  records: number
}

export interface MonthExercise {
  exerciseId: string
  sets: number
  volume: number
  /** Лучший вес за месяц (для силовых), кг; 0 — нет. */
  topWeight: number
  /** Лучший расчётный максимум за месяц, кг; 0 — нет. */
  e1rm: number
}

export interface MonthReport {
  /** Первое число месяца, «2026-09-01». */
  month: string
  totals: MonthTotals
  previous: MonthTotals
  /** Дни с тренировками — для календаря. */
  days: string[]
  /** Недели месяца, в которые выполнена цель (неделя считается по понедельнику). */
  goalWeeks: number
  weeks: number
  muscles: { muscle: MuscleGroup; sets: number }[]
  exercises: MonthExercise[]
  /** Самая объёмная тренировка. */
  best?: { workoutId: string; volume: number }
}

const inMonth = (date: string, month: string) => date >= month && date < addMonths(month, 1)

function totalsOf(list: readonly Workout[]): MonthTotals {
  return {
    workouts: list.length,
    seconds: list.reduce((s, w) => s + workoutSeconds(w), 0),
    volume: list.reduce((s, w) => s + (w.summary?.volume ?? 0), 0),
    sets: list.reduce((s, w) => s + (w.summary?.sets ?? 0), 0),
    records: list.reduce((s, w) => s + (w.summary?.records ?? 0), 0),
  }
}

/**
 * Итоги месяца: сколько, сколько по времени и объёму, против прошлого месяца;
 * какие группы мышц и упражнения были главными, сколько недель выполнена цель.
 */
export function monthReport(
  anyDayOfMonth: string,
  workouts: readonly Workout[],
  entries: readonly WorkoutEntry[],
  exercises: ReadonlyMap<string, Pick<Exercise, 'kind' | 'muscle'>>,
  weeklyGoal: number,
): MonthReport {
  const month = startOfMonth(anyDayOfMonth)
  const done = workouts.filter((w) => w.status === 'done')
  const list = done.filter((w) => inMonth(w.date, month))
  const prevMonth = addMonths(month, -1)
  const ids = new Set(list.map((w) => w.id))

  const muscles = new Map<MuscleGroup, number>()
  const perExercise = new Map<string, MonthExercise>()
  for (const e of entries) {
    if (!ids.has(e.workoutId)) continue
    const ex = exercises.get(e.exerciseId)
    if (!ex) continue
    const item = perExercise.get(e.exerciseId) ?? {
      exerciseId: e.exerciseId,
      sets: 0,
      volume: 0,
      topWeight: 0,
      e1rm: 0,
    }
    for (const s of e.sets) {
      if (!counts(ex.kind, s)) continue
      item.sets++
      item.volume += setVolume(ex.kind, s)
      if (ex.kind === 'strength') {
        item.topWeight = Math.max(item.topWeight, s.weight ?? 0)
        item.e1rm = Math.max(item.e1rm, estimate1RM(s.weight ?? 0, s.reps ?? 0))
      }
      muscles.set(ex.muscle, (muscles.get(ex.muscle) ?? 0) + 1)
    }
    if (item.sets > 0) perExercise.set(e.exerciseId, item)
  }

  // Неделя — месяца, на который приходится её четверг (как недели года в ISO 8601):
  // каждая неделя попадает ровно в один месяц, а 31 августа — 6 сентября — в сентябрь.
  const weekStarts: string[] = []
  for (let d = startOfWeek(month); d < addMonths(month, 1); d = addDays(d, 7)) {
    if (inMonth(addDays(d, 3), month)) weekStarts.push(d)
  }
  const perWeek = new Map<string, number>()
  for (const w of done) {
    const week = startOfWeek(w.date)
    perWeek.set(week, (perWeek.get(week) ?? 0) + 1)
  }

  const best = list.reduce<Workout | undefined>(
    (b, w) => ((w.summary?.volume ?? 0) > (b?.summary?.volume ?? 0) ? w : b),
    undefined,
  )

  return {
    month,
    totals: totalsOf(list),
    previous: totalsOf(done.filter((w) => inMonth(w.date, prevMonth))),
    days: [...new Set(list.map((w) => w.date))].sort(),
    goalWeeks: weekStarts.filter((w) => (perWeek.get(w) ?? 0) >= weeklyGoal).length,
    weeks: weekStarts.length,
    muscles: [...muscles.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([muscle, sets]) => ({ muscle, sets })),
    exercises: [...perExercise.values()].sort((a, b) => b.sets - a.sets || b.volume - a.volume),
    ...(best && (best.summary?.volume ?? 0) > 0
      ? { best: { workoutId: best.id, volume: best.summary?.volume ?? 0 } }
      : {}),
  }
}
