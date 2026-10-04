import { describe, expect, it } from 'vitest'
import {
  addSession,
  bestsOfSets,
  countRecords,
  emptyBests,
  estimate1RM,
  recordSets,
  repMaxes,
} from './records'
import type { WorkoutSet } from './types'

let n = 0
const set = (v: Partial<WorkoutSet>): WorkoutSet => ({
  id: `s${++n}`,
  type: 'normal',
  done: true,
  ...v,
})

describe('estimate1RM', () => {
  it('Эпли: 100 × 5 ≈ 116,7, на одном повторе — сам вес', () => {
    expect(estimate1RM(100, 5)).toBeCloseTo(116.67, 1)
    expect(estimate1RM(100, 1)).toBe(100)
    expect(estimate1RM(0, 5)).toBe(0)
  })
  it('сто на одном и сто на восьми — разные силы', () => {
    expect(estimate1RM(100, 8)).toBeGreaterThan(estimate1RM(100, 1))
  })
})

describe('лучшие значения', () => {
  it('разминка и невыполненные подходы не считаются', () => {
    const b = bestsOfSets('strength', [
      set({ type: 'warmup', weight: 120, reps: 5 }),
      set({ weight: 110, reps: 5, done: false }),
      set({ weight: 100, reps: 5 }),
    ])
    expect(b.weight).toBe(100)
    expect(b.setVolume).toBe(500)
  })
  it('темп: меньше — лучше, короткие отрезки не в счёт', () => {
    let b = emptyBests()
    b = addSession('cardio', b, [set({ seconds: 1800, distance: 5 })])
    b = addSession('cardio', b, [set({ seconds: 300, distance: 0.3 })])
    b = addSession('cardio', b, [set({ seconds: 1500, distance: 5 })])
    expect(b.pace).toBe(300)
    expect(b.distance).toBe(5)
    expect(b.sessions).toBe(3)
  })
})

describe('рекорды в тренировке', () => {
  it('без истории рекордов нет', () => {
    expect(recordSets('strength', emptyBests(), [set({ weight: 100, reps: 5 })]).size).toBe(0)
  })
  it('рекорд — подход, превзошедший историю и прошлые подходы', () => {
    const history = addSession('strength', emptyBests(), [set({ weight: 100, reps: 5 })])
    const a = set({ weight: 100, reps: 5 }) // повтор, не рекорд
    const b = set({ weight: 102.5, reps: 5 }) // вес и максимум
    const c = set({ weight: 100, reps: 8 }) // объём подхода, но вес уже не рекорд
    const marks = recordSets('strength', history, [a, b, c])
    expect(marks.has(a.id)).toBe(false)
    expect(marks.get(b.id)).toEqual(['e1rm', 'weight', 'setVolume'])
    expect(marks.get(c.id)).toEqual(['e1rm', 'setVolume'])
    expect(countRecords('strength', history, [a, b, c])).toBe(3)
  })
  it('свой вес: повторы и отягощение', () => {
    const history = addSession('bodyweight', emptyBests(), [set({ reps: 10 })])
    const marks = recordSets('bodyweight', history, [
      set({ reps: 12 }),
      set({ reps: 8, weight: 5 }),
    ])
    expect([...marks.values()]).toEqual([['reps'], ['weight']])
  })
})

describe('repMaxes', () => {
  it('вес на N повторов не меньше, чем на большее число повторов', () => {
    const rm = repMaxes([set({ weight: 100, reps: 5 }), set({ weight: 110, reps: 2 })], 6)
    expect(rm).toEqual([110, 110, 100, 100, 100, undefined])
  })
})
