import { formatNumber } from './format'
import type { BodyLog } from './types'

export type BodyMetric = 'weight' | 'bodyFat' | 'waist' | 'chest' | 'hips' | 'arms'

export interface BodyMetricDef {
  key: BodyMetric
  /** В списке и на кнопках: «Вес», «Талия». */
  label: string
  /** В строке замера: «талия 88 см», «жир 18 %». */
  short: string
  unit: string
  /** Разумные пределы: за ними почти наверняка опечатка. */
  min: number
  max: number
  placeholder: string
}

export const BODY_METRICS: readonly BodyMetricDef[] = [
  { key: 'weight', label: 'Вес', short: 'вес', unit: 'кг', min: 20, max: 400, placeholder: '78,5' },
  { key: 'bodyFat', label: '% жира', short: 'жир', unit: '%', min: 2, max: 70, placeholder: '18' },
  {
    key: 'waist',
    label: 'Талия',
    short: 'талия',
    unit: 'см',
    min: 30,
    max: 250,
    placeholder: '84',
  },
  {
    key: 'chest',
    label: 'Грудь',
    short: 'грудь',
    unit: 'см',
    min: 40,
    max: 250,
    placeholder: '102',
  },
  { key: 'hips', label: 'Бёдра', short: 'бёдра', unit: 'см', min: 40, max: 250, placeholder: '98' },
  { key: 'arms', label: 'Руки', short: 'руки', unit: 'см', min: 10, max: 80, placeholder: '38' },
]

export const BODY_METRIC: Record<BodyMetric, BodyMetricDef> = Object.fromEntries(
  BODY_METRICS.map((m) => [m.key, m]),
) as Record<BodyMetric, BodyMetricDef>

export function formatBodyValue(metric: BodyMetric, v: number): string {
  const def = BODY_METRIC[metric]
  return `${formatNumber(v, 1)}${def.unit === '%' ? ' %' : ` ${def.unit}`}`
}

/** Какие показатели вообще записывались — в порядке BODY_METRICS. */
export function measuredMetrics(logs: readonly BodyLog[]): BodyMetric[] {
  return BODY_METRICS.filter((m) => logs.some((l) => l[m.key] !== undefined)).map((m) => m.key)
}

/** Значение в пределах показателя — иначе это опечатка, а не замер. */
export function inRange(metric: BodyMetric, v: number): boolean {
  const def = BODY_METRIC[metric]
  return v >= def.min && v <= def.max
}

/**
 * Изменение за месяц: последнее значение против последнего, записанного месяц назад
 * или раньше. null — сравнивать не с чем.
 */
export function monthChange(
  logs: readonly BodyLog[],
  metric: BodyMetric,
  monthAgo: string,
): number | null {
  const withValue = logs.filter((l) => l[metric] !== undefined)
  const last = withValue.at(-1)?.[metric]
  const before = withValue.filter((l) => l.date <= monthAgo).at(-1)?.[metric]
  if (last === undefined || before === undefined) return null
  return last - before
}
