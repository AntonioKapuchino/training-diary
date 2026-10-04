import { describe, expect, it } from 'vitest'
import { monotonePath, nearestIndex, niceTicks } from './geometry'

describe('niceTicks', () => {
  it('ровные деления', () => {
    expect(niceTicks(0, 100, 4)).toEqual([0, 25, 50, 75, 100])
    expect(niceTicks(57.5, 82.5, 4)).toEqual([50, 60, 70, 80, 90])
    expect(niceTicks(0, 3, 3)).toEqual([0, 1, 2, 3])
  })
  it('одно значение — раздвигает диапазон', () => {
    const t = niceTicks(60, 60, 4)
    expect(t[0]).toBeLessThan(60)
    expect(t.at(-1)).toBeGreaterThan(60)
  })
})

describe('monotonePath', () => {
  it('одна и две точки', () => {
    expect(monotonePath([{ x: 0, y: 0 }])).toBe('M0.0,0.0')
    expect(
      monotonePath([
        { x: 0, y: 0 },
        { x: 10, y: 10 },
      ]),
    ).toMatch(/^M0\.0,0\.0C/)
  })
  it('не падает на совпадающих x', () => {
    expect(() =>
      monotonePath([
        { x: 0, y: 0 },
        { x: 0, y: 5 },
        { x: 10, y: 5 },
      ]),
    ).not.toThrow()
  })
})

describe('nearestIndex', () => {
  it('ищет ближайшую точку', () => {
    expect(nearestIndex([0, 10, 20], 14)).toBe(1)
    expect(nearestIndex([0, 10, 20], 16)).toBe(2)
  })
})
