import { describe, expect, it } from 'vitest'
import { platesFor } from './plates'
import { sessionPoint, streakWeeks, summarize, weeklyBuckets, workoutSeconds } from './stats'
import type { WorkoutSet } from './types'

let n = 0
const set = (v: Partial<WorkoutSet>): WorkoutSet => ({
  id: `s${++n}`,
  type: 'normal',
  done: true,
  ...v,
})

describe('summarize', () => {
  it('считает только выполненные рабочие подходы', () => {
    const s = summarize([
      {
        kind: 'strength',
        muscle: 'chest',
        sets: [
          set({ type: 'warmup', weight: 40, reps: 10 }),
          set({ weight: 60, reps: 8 }),
          set({ weight: 60, reps: 8 }),
          set({ weight: 60, reps: 8, done: false }),
        ],
      },
      { kind: 'bodyweight', muscle: 'back', sets: [set({ reps: 10 })] },
      { kind: 'timed', muscle: 'core', sets: [set({ seconds: 60, done: false })] },
    ])
    expect(s).toEqual({
      exercises: 2,
      sets: 3,
      volume: 960,
      reps: 26,
      muscles: ['chest', 'back'],
      records: 0,
    })
  })
})

describe('недели', () => {
  it('раскладывает тренировки по неделям', () => {
    const buckets = weeklyBuckets(
      [
        { date: '2026-09-21', startedAt: 0, finishedAt: 3_600_000 },
        { date: '2026-09-30', startedAt: 0, finishedAt: 1_800_000 },
        { date: '2026-10-02', startedAt: 0 },
        { date: '2026-08-01', startedAt: 0 },
      ],
      '2026-10-04',
      2,
    )
    expect(buckets.map((b) => [b.week, b.workouts, b.seconds])).toEqual([
      ['2026-09-21', 1, 3600],
      ['2026-09-28', 2, 1800],
    ])
  })
  it('серия: текущая неделя без цели серию не рвёт', () => {
    const dates = ['2026-09-14', '2026-09-16', '2026-09-21', '2026-09-23', '2026-09-29']
    expect(streakWeeks(dates, 2, '2026-10-01')).toBe(2)
    expect(streakWeeks([...dates, '2026-10-01'], 2, '2026-10-01')).toBe(3)
    expect(streakWeeks(dates, 2, '2026-10-08')).toBe(0)
  })
  it('длительность старых тренировок неизвестна', () => {
    expect(workoutSeconds({ startedAt: 1000, finishedAt: 1000 })).toBe(0)
    expect(workoutSeconds({ startedAt: 0, finishedAt: 2_700_000 })).toBe(2700)
  })
})

describe('sessionPoint', () => {
  it('силовое: лучший максимум, вес и объём', () => {
    const p = sessionPoint('strength', 'w', 0, [
      set({ weight: 100, reps: 5 }),
      set({ weight: 90, reps: 10 }),
      set({ type: 'warmup', weight: 140, reps: 1 }),
    ])
    expect(p?.weight).toBe(100)
    expect(p?.volume).toBe(1400)
    expect(p?.e1rm).toBeCloseTo(120, 5)
    expect(p?.sets).toBe(2)
  })
  it('кардио: средний темп', () => {
    const p = sessionPoint('cardio', 'w', 0, [set({ seconds: 1500, distance: 5 })])
    expect(p?.pace).toBe(300)
  })
  it('без выполненных подходов точки нет', () => {
    expect(sessionPoint('strength', 'w', 0, [set({ weight: 100, reps: 5, done: false })])).toBe(
      null,
    )
  })
})

describe('platesFor', () => {
  it('раскладывает блины на сторону', () => {
    expect(platesFor(100, 20)).toEqual({ perSide: [25, 15], total: 100, missing: 0 })
    expect(platesFor(62.5, 20)).toEqual({ perSide: [20, 1.25], total: 62.5, missing: 0 })
  })
  it('сообщает, если точно не набрать', () => {
    expect(platesFor(61, 20)).toEqual({ perSide: [20], total: 60, missing: 1 })
    expect(platesFor(15, 20)).toBeNull()
  })
})
