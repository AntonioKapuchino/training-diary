import { describe, expect, it } from 'vitest'
import { warmupPlan } from './warmup'

const S = { barWeight: 20, plates: [25, 20, 15, 10, 5, 2.5, 1.25], weightStep: 2.5 }

describe('разминка', () => {
  it('штанга: пустой гриф, потом 40, 60, 80 % под блины', () => {
    expect(warmupPlan(80, 'barbell', S)).toEqual([
      { weight: 20, reps: 10 },
      { weight: 32.5, reps: 8 },
      { weight: 47.5, reps: 5 },
      { weight: 65, reps: 3 },
    ])
  })
  it('лёгкий рабочий вес — меньше ступеней, без повторов одного веса', () => {
    expect(warmupPlan(40, 'barbell', S)).toEqual([
      { weight: 20, reps: 10 },
      { weight: 25, reps: 5 },
      { weight: 32.5, reps: 3 },
    ])
    expect(warmupPlan(22, 'barbell', S)).toEqual([{ weight: 20, reps: 10 }])
    expect(warmupPlan(20, 'barbell', S)).toEqual([])
  })
  it('гантели — шагом веса и без грифа', () => {
    expect(warmupPlan(28, 'dumbbell', S)).toEqual([
      { weight: 10, reps: 8 },
      { weight: 17.5, reps: 5 },
      { weight: 22.5, reps: 3 },
    ])
    expect(warmupPlan(10, 'dumbbell', S)).toEqual([
      { weight: 5, reps: 8 },
      { weight: 7.5, reps: 3 },
    ])
  })
  it('без рабочего веса разминки нет', () => {
    expect(warmupPlan(0, 'barbell', S)).toEqual([])
  })
})
