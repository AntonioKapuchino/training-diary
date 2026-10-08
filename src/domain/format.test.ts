import { describe, expect, it } from 'vitest'
import {
  countLabel,
  formatClock,
  formatDuration,
  formatNumber,
  formatPace,
  formatSetTime,
  formatVolume,
  formatWeight,
  parseDecimal,
  plural,
  roundTo,
  parseDurationInput,
} from './format'

/** Intl ставит неразрывные пробелы — в тестах сравниваем с обычными. */
const s = (x: string) => x.replace(/\s/g, ' ')

describe('formatNumber', () => {
  it('ставит запятую и группирует разряды', () => {
    expect(formatNumber(62.5)).toBe('62,5')
    expect(s(formatNumber(3675))).toBe('3 675')
    expect(formatNumber(1.25)).toBe('1,25')
  })
  it('не показывает хвосты плавающей точки', () => {
    expect(formatNumber(0.1 + 0.2)).toBe('0,3')
  })
})

describe('единицы', () => {
  it('вес и объём', () => {
    expect(formatWeight(97.5)).toBe('97,5 кг')
    expect(s(formatVolume(3675.4))).toBe('3 675 кг')
    expect(s(formatVolume(125_000))).toBe('125 т')
  })
  it('время подходов и тренировок', () => {
    expect(formatClock(45)).toBe('0:45')
    expect(formatClock(1935)).toBe('32:15')
    expect(formatClock(3912)).toBe('1:05:12')
    expect(formatDuration(45)).toBe('45 сек')
    expect(formatDuration(48 * 60)).toBe('48 мин')
    expect(formatDuration(65 * 60)).toBe('1 ч 5 мин')
    expect(formatDuration(120 * 60)).toBe('2 ч')
    expect(formatSetTime(40)).toBe('40 с')
    expect(formatSetTime(90)).toBe('1:30')
    expect(formatPace(320)).toBe('5:20 /км')
  })
})

describe('plural', () => {
  it('склоняет по-русски', () => {
    const p = (n: number) => plural(n, 'подход', 'подхода', 'подходов')
    expect([1, 2, 5, 11, 12, 21, 22, 25, 101, 111].map(p)).toEqual([
      'подход',
      'подхода',
      'подходов',
      'подходов',
      'подходов',
      'подход',
      'подхода',
      'подходов',
      'подход',
      'подходов',
    ])
    expect(countLabel(3, 'подход', 'подхода', 'подходов')).toBe('3 подхода')
  })
})

describe('parseDecimal', () => {
  it('понимает запятую и точку', () => {
    expect(parseDecimal('52,5')).toBe(52.5)
    expect(parseDecimal('52.5')).toBe(52.5)
    expect(parseDecimal(' 1 000 ')).toBe(1000)
    expect(parseDecimal('52,')).toBe(52)
  })
  it('пустое и мусор — undefined', () => {
    expect(parseDecimal('')).toBeUndefined()
    expect(parseDecimal(',')).toBeUndefined()
    expect(parseDecimal('abc')).toBeUndefined()
    expect(parseDecimal('1,2,3')).toBeUndefined()
  })
})

describe('roundTo', () => {
  it('округляет до шага без хвостов', () => {
    expect(roundTo(62.49, 2.5)).toBe(62.5)
    expect(roundTo(0.1 + 0.2, 0.1)).toBe(0.3)
    expect(roundTo(41.3, 1.25)).toBe(41.25)
  })
  it('длительность цифрами без двоеточия — как на микроволновке', () => {
    expect(parseDurationInput('130')).toBe(90)
    expect(parseDurationInput('1800')).toBe(1080)
    expect(parseDurationInput('45')).toBe(45)
    expect(parseDurationInput('1:30')).toBe(90)
    expect(parseDurationInput('12000')).toBe(7200)
    expect(parseDurationInput('1,5')).toBeUndefined()
  })
})
