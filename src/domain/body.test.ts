import { describe, expect, it } from 'vitest'
import { formatBodyValue, inRange, measuredMetrics, monthChange } from './body'
import type { BodyLog } from './types'

const log = (date: string, values: Partial<BodyLog>): BodyLog => ({
  id: date,
  date,
  createdAt: 0,
  updatedAt: 0,
  ...values,
})

describe('замеры тела', () => {
  const logs = [
    log('2026-08-01', { weight: 84, waist: 92, arms: 38 }),
    log('2026-09-01', { weight: 83 }),
    log('2026-10-01', { weight: 81.5, waist: 89 }),
  ]
  it('показатели, которые записывались, — по порядку', () => {
    expect(measuredMetrics(logs)).toEqual(['weight', 'waist', 'arms'])
    expect(measuredMetrics([])).toEqual([])
  })
  it('изменение за месяц — от последнего замера месячной давности', () => {
    expect(monthChange(logs, 'weight', '2026-09-08')).toBe(-1.5)
    expect(monthChange(logs, 'waist', '2026-09-08')).toBe(-3)
    expect(monthChange(logs, 'chest', '2026-09-08')).toBeNull()
    expect(monthChange(logs, 'weight', '2026-07-01')).toBeNull()
  })
  it('пределы ловят опечатки, единицы — по показателю', () => {
    expect(inRange('weight', 815)).toBe(false)
    expect(inRange('bodyFat', 18)).toBe(true)
    expect(formatBodyValue('bodyFat', 17.5)).toBe('17,5 %')
    expect(formatBodyValue('waist', 88)).toBe('88 см')
  })
})
