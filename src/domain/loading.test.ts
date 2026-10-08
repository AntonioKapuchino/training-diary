import { describe, expect, it } from 'vitest'
import { percentTable, repsAtPercent, roundLoadable } from './loading'

const S = { barWeight: 20, plates: [25, 20, 15, 10, 5, 2.5, 1.25], weightStep: 2.5 }

describe('веса под блины', () => {
  it('штанга: гриф плюс пара самых маленьких блинов', () => {
    expect(roundLoadable(76.4, 'barbell', S)).toBe(77.5)
    expect(roundLoadable(75.9, 'barbell', S)).toBe(75)
    expect(roundLoadable(12, 'barbell', S)).toBe(20)
    expect(roundLoadable(76, 'barbell', { ...S, plates: [20, 10, 5, 2.5] })).toBe(75)
  })
  it('гантели и тренажёры — шагом веса', () => {
    expect(roundLoadable(23.4, 'dumbbell', S)).toBe(22.5)
    expect(roundLoadable(1, 'machine', S)).toBe(2.5)
    expect(roundLoadable(23.4, 'cable', { ...S, weightStep: 1 })).toBe(23)
  })
})

describe('проценты от максимума', () => {
  it('повторы по обратной формуле Эпли', () => {
    expect(repsAtPercent(95)).toBe(2)
    expect(repsAtPercent(80)).toBe(8)
    expect(repsAtPercent(75)).toBe(10)
    expect(repsAtPercent(100)).toBe(1)
  })
  it('таблица от 100 кг — веса под штангу', () => {
    const rows = percentTable(100, 'barbell', S)
    expect(rows.map((r) => r.weight)).toEqual([95, 90, 85, 80, 75, 70, 65, 60, 50])
    expect(percentTable(101.3, 'barbell', S)[0]).toEqual({ percent: 95, weight: 95, reps: 2 })
    expect(percentTable(0, 'barbell', S)).toEqual([])
  })
})
