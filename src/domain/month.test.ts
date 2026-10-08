import { describe, expect, it } from 'vitest'
import { monthReport } from './month'
import type { Workout, WorkoutEntry } from './types'

const at = (date: string, hh = 19) => Date.parse(`${date}T${String(hh)}:00:00+03:00`)

function workout(id: string, date: string, volume: number, records = 0): Workout {
  return {
    id,
    status: 'done',
    date,
    startedAt: at(date),
    finishedAt: at(date) + 3_600_000,
    createdAt: 0,
    updatedAt: 0,
    summary: { exercises: 1, sets: 3, volume, reps: 24, muscles: ['chest'], records },
  }
}

function entry(workoutId: string, exerciseId: string, sets: [number, number][]): WorkoutEntry {
  return {
    id: `${workoutId}-${exerciseId}`,
    workoutId,
    exerciseId,
    startedAt: 0,
    order: 0,
    updatedAt: 0,
    sets: sets.map(([weight, reps], i) => ({
      id: String(i),
      type: 'normal',
      weight,
      reps,
      done: true,
    })),
  }
}

const EX = new Map([
  ['bench', { kind: 'strength' as const, muscle: 'chest' as const }],
  ['squat', { kind: 'strength' as const, muscle: 'legs' as const }],
])

describe('итоги месяца', () => {
  const workouts = [
    workout('a', '2026-08-28', 1000),
    workout('b', '2026-09-01', 2000, 2),
    workout('c', '2026-09-03', 3000, 1),
    workout('d', '2026-09-03', 500),
    workout('e', '2026-09-30', 1500),
    workout('f', '2026-10-01', 9999),
  ]
  const entries = [
    entry('b', 'bench', [
      [60, 8],
      [60, 8],
    ]),
    entry('c', 'squat', [[100, 5]]),
    entry('c', 'bench', [[70, 5]]),
    entry('f', 'bench', [[90, 5]]),
  ]
  const r = monthReport('2026-09-15', workouts, entries, EX, 3)

  it('считает только этот месяц и сравнивает с прошлым', () => {
    expect(r.month).toBe('2026-09-01')
    expect(r.totals).toMatchObject({ workouts: 4, volume: 7000, records: 3, seconds: 4 * 3600 })
    expect(r.previous).toMatchObject({ workouts: 1, volume: 1000 })
    expect(r.days).toEqual(['2026-09-01', '2026-09-03', '2026-09-30'])
  })

  it('упражнения — по числу подходов, с лучшим весом месяца', () => {
    expect(r.exercises.map((e) => [e.exerciseId, e.sets, e.topWeight])).toEqual([
      ['bench', 3, 70],
      ['squat', 1, 100],
    ])
    expect(r.muscles).toEqual([
      { muscle: 'chest', sets: 3 },
      { muscle: 'legs', sets: 1 },
    ])
  })

  it('недели с выполненной целью и лучшая тренировка', () => {
    // Недели сентября 2026 по четвергу: с 31 августа, 7, 14 и 21 сентября; с 28-го — октябрьская.
    // В первой три тренировки — цель выполнена.
    expect(r.weeks).toBe(4)
    expect(r.goalWeeks).toBe(1)
    expect(r.best).toEqual({ workoutId: 'c', volume: 3000 })
  })

  it('пустой месяц — нули, а не ошибка', () => {
    const empty = monthReport('2026-05-10', workouts, entries, EX, 3)
    expect(empty.totals.workouts).toBe(0)
    expect(empty.best).toBeUndefined()
    expect(empty.exercises).toEqual([])
  })
})
