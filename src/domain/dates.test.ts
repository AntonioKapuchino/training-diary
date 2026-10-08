import { describe, expect, it } from 'vitest'
import {
  addDays,
  addMonths,
  combineDateTime,
  daysBetween,
  formatAgo,
  formatDayMonth,
  formatMonthYear,
  formatRelativeDay,
  formatWeekdayDayMonth,
  isISODate,
  startOfWeek,
  toISODate,
  toTimeInput,
  weekDays,
  monthGenitive,
  monthPrepositional,
} from './dates'

const s = (x: string) => x.replace(/\s/g, ' ')

describe('календарная арифметика', () => {
  it('сдвигает дни через границы месяцев и лет', () => {
    expect(addDays('2026-10-04', 1)).toBe('2026-10-05')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(daysBetween('2026-10-01', '2026-10-04')).toBe(3)
  })
  it('неделя начинается с понедельника', () => {
    expect(startOfWeek('2026-10-04')).toBe('2026-09-28') // воскресенье
    expect(startOfWeek('2026-09-28')).toBe('2026-09-28') // понедельник
    expect(weekDays('2026-10-01')).toEqual([
      '2026-09-28',
      '2026-09-29',
      '2026-09-30',
      '2026-10-01',
      '2026-10-02',
      '2026-10-03',
      '2026-10-04',
    ])
  })
  it('месяцы', () => {
    expect(addMonths('2026-10-17', 1)).toBe('2026-11-01')
    expect(addMonths('2026-01-31', -1)).toBe('2025-12-01')
  })
  it('проверяет формат даты', () => {
    expect(isISODate('2026-10-04')).toBe(true)
    expect(isISODate('')).toBe(false)
    expect(isISODate('2026-02-30')).toBe(false)
    expect(isISODate('abc')).toBe(false)
  })
  it('собирает дату и время', () => {
    const ms = combineDateTime('2026-10-04', '18:42')
    expect(toISODate(new Date(ms))).toBe('2026-10-04')
    expect(toTimeInput(ms)).toBe('18:42')
  })
})

describe('подписи', () => {
  const today = '2026-10-04'
  it('дни по-русски', () => {
    expect(formatDayMonth('2026-10-02', today)).toBe('2 октября')
    expect(s(formatDayMonth('2025-10-02', today))).toBe('2 октября 2025 г.')
    expect(formatWeekdayDayMonth('2026-10-04', today)).toBe('воскресенье, 4 октября')
  })
  it('относительные', () => {
    expect(formatRelativeDay(today, today)).toBe('Сегодня')
    expect(formatRelativeDay('2026-10-03', today)).toBe('Вчера')
    expect(formatRelativeDay('2026-10-01', today)).toBe('Чт, 1 октября')
    expect(formatAgo('2026-10-01', today)).toBe('3 дня назад')
    expect(formatAgo('2026-09-27', today)).toBe('неделю назад')
    expect(formatAgo('2026-09-10', today)).toBe('3 недели назад')
    expect(formatAgo('2026-07-01', today)).toBe('3 месяца назад')
  })
  it('месяц с заглавной, год — только для прошлых лет', () => {
    expect(formatMonthYear('2026-10-04', today)).toBe('Октябрь')
    expect(formatMonthYear('2025-12-01', today)).toBe('Декабрь 2025')
  })
  it('месяц в падежах: «итоги сентября», «чем в августе»', () => {
    expect(monthGenitive('2026-09-01')).toBe('сентября')
    expect(monthGenitive('2026-05-17')).toBe('мая')
    expect(monthPrepositional('2026-08-01')).toBe('августе')
  })
})
