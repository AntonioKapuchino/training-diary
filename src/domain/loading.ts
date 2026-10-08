import type { Equipment } from './types'

/**
 * Веса, которые реально можно собрать: штанга — гриф плюс по паре самых маленьких
 * блинов, остальное — шагом веса из настроек (гантели, блок, тренажёр).
 */
export interface LoadingSettings {
  barWeight: number
  plates: readonly number[]
  weightStep: number
}

/** Округление веса до ближайшего, который можно поставить на этом снаряде. */
export function roundLoadable(weight: number, equipment: Equipment, s: LoadingSettings): number {
  if (weight <= 0) return 0
  if (equipment === 'barbell') {
    const smallest = Math.min(...s.plates.filter((p) => p > 0))
    const step = Number.isFinite(smallest) ? smallest * 2 : s.weightStep
    if (weight <= s.barWeight) return s.barWeight
    return roundTo(s.barWeight + Math.round((weight - s.barWeight) / step) * step)
  }
  const step = s.weightStep > 0 ? s.weightStep : 1
  return roundTo(Math.max(step, Math.round(weight / step) * step))
}

const roundTo = (x: number) => Math.round(x * 1000) / 1000

/** Сколько раз поднимается вес в p% от разового максимума — обратная формула Эпли. */
export function repsAtPercent(percent: number): number {
  if (percent >= 100) return 1
  return Math.max(1, Math.round(30 * (100 / percent - 1)))
}

export interface PercentRow {
  percent: number
  weight: number
  reps: number
}

export const PERCENTS = [95, 90, 85, 80, 75, 70, 65, 60, 50] as const

/** Таблица «проценты от максимума»: вес под блины и примерное число повторов. */
export function percentTable(
  oneRepMax: number,
  equipment: Equipment,
  s: LoadingSettings,
  percents: readonly number[] = PERCENTS,
): PercentRow[] {
  if (oneRepMax <= 0) return []
  return percents.map((percent) => ({
    percent,
    weight: roundLoadable((oneRepMax * percent) / 100, equipment, s),
    reps: repsAtPercent(percent),
  }))
}
