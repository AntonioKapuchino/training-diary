import { roundLoadable, type LoadingSettings } from './loading'
import type { Equipment } from './types'

export interface WarmupStep {
  weight: number
  reps: number
}

/** Ступени разминки: доля рабочего веса и повторы — чем тяжелее, тем меньше. */
const STEPS = [
  { share: 0.4, reps: 8 },
  { share: 0.6, reps: 5 },
  { share: 0.8, reps: 3 },
] as const

/**
 * Разминка до рабочего веса: для штанги сначала пустой гриф на 10 раз, дальше примерно
 * 40, 60 и 80 % на 8, 5 и 3 повтора. Веса — те, что можно собрать (гриф и блины или шаг
 * веса), совпавшие после округления не повторяются, всё строго легче рабочего.
 */
export function warmupPlan(
  working: number,
  equipment: Equipment,
  s: LoadingSettings,
): WarmupStep[] {
  if (working <= 0) return []
  const steps: WarmupStep[] = []
  if (equipment === 'barbell' && s.barWeight > 0 && s.barWeight < working) {
    steps.push({ weight: s.barWeight, reps: 10 })
  }
  for (const step of STEPS) {
    const weight = roundLoadable(working * step.share, equipment, s)
    const prev = steps.at(-1)?.weight ?? 0
    if (weight > prev && weight < working) steps.push({ weight, reps: step.reps })
  }
  return steps
}
