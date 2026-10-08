import { counts } from './sets'
import type { ExerciseKind, WorkoutSet } from './types'

/**
 * Расчётный разовый максимум по формуле Эпли: вес × (1 + повторы / 30).
 * На одном повторе — сам вес. Дальше 15 повторов формула завышает, поэтому повторы ограничены.
 */
export function estimate1RM(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0
  if (reps === 1) return weight
  return weight * (1 + Math.min(reps, 15) / 30)
}

export type RecordType = 'e1rm' | 'weight' | 'setVolume' | 'reps' | 'duration' | 'distance' | 'pace'

/** Лучшие значения по упражнению. pace — секунды на км, меньше — лучше, 0 — нет данных. */
export type Bests = Record<RecordType, number> & { sessions: number }

export const RECORD_TYPES: Record<ExerciseKind, readonly RecordType[]> = {
  strength: ['e1rm', 'weight', 'setVolume'],
  bodyweight: ['reps', 'weight'],
  timed: ['duration'],
  cardio: ['distance', 'duration', 'pace'],
}

export const RECORD_LABEL: Record<RecordType, string> = {
  e1rm: 'Расчётный максимум',
  weight: 'Максимальный вес',
  setVolume: 'Объём за подход',
  reps: 'Повторы за подход',
  duration: 'Время',
  distance: 'Дистанция',
  pace: 'Темп',
}

export function emptyBests(): Bests {
  return {
    e1rm: 0,
    weight: 0,
    setVolume: 0,
    reps: 0,
    duration: 0,
    distance: 0,
    pace: 0,
    sessions: 0,
  }
}

/** Темп считается от полукилометра — короткие отрезки дают случайные рекорды. */
const MIN_PACE_KM = 0.5

/** Показатели одного подхода; для неподходящих подходов — пусто. */
export function setMetrics(kind: ExerciseKind, s: WorkoutSet): Partial<Record<RecordType, number>> {
  if (!counts(kind, s)) return {}
  const w = s.weight ?? 0
  const r = s.reps ?? 0
  switch (kind) {
    case 'strength':
      return w > 0 ? { e1rm: estimate1RM(w, r), weight: w, setVolume: w * r } : {}
    case 'bodyweight':
      return w > 0 ? { reps: r, weight: w } : { reps: r }
    case 'timed':
      return { duration: s.seconds ?? 0 }
    case 'cardio': {
      const sec = s.seconds ?? 0
      const km = s.distance ?? 0
      const out: Partial<Record<RecordType, number>> = {}
      if (km > 0) out.distance = km
      if (sec > 0) out.duration = sec
      if (km >= MIN_PACE_KM && sec > 0) out.pace = sec / km
      return out
    }
  }
}

/**
 * Разница меньше этой — равенство. 70 × 10 и 80 × 5 по Эпли дают одно и то же,
 * но в плавающей точке второе на 1e-14 больше — и без допуска стало бы «рекордом».
 */
const EPS = 1e-6

export function isBetter(type: RecordType, value: number, best: number): boolean {
  if (value <= 0) return false
  if (type === 'pace') return best === 0 || value < best - EPS
  return value > best + EPS
}

function absorb(b: Bests, m: Partial<Record<RecordType, number>>): void {
  for (const [type, value] of Object.entries(m) as [RecordType, number][]) {
    if (isBetter(type, value, b[type])) b[type] = value
  }
}

/** Лучшие значения по набору подходов одной или нескольких тренировок. */
export function bestsOfSets(kind: ExerciseKind, sets: readonly WorkoutSet[]): Bests {
  const b = emptyBests()
  for (const s of sets) absorb(b, setMetrics(kind, s))
  return b
}

/** Добавляет тренировку в копилку лучших значений. */
export function addSession(kind: ExerciseKind, b: Bests, sets: readonly WorkoutSet[]): Bests {
  const next = { ...b }
  let any = false
  for (const s of sets) {
    const m = setMetrics(kind, s)
    if (Object.keys(m).length > 0) any = true
    absorb(next, m)
  }
  if (any) next.sessions += 1
  return next
}

/**
 * Какие подходы этой тренировки — рекорды. Подход — рекорд, если превзошёл и историю,
 * и все предыдущие подходы этой же тренировки. Пока истории нет, рекордов нет:
 * первая тренировка с упражнением — точка отсчёта, а не рекорд.
 */
export function recordSets(
  kind: ExerciseKind,
  history: Bests,
  sets: readonly WorkoutSet[],
): Map<string, RecordType[]> {
  const result = new Map<string, RecordType[]>()
  if (history.sessions === 0) return result
  const running: Bests = { ...history }
  for (const s of sets) {
    const m = setMetrics(kind, s)
    const won: RecordType[] = []
    for (const type of RECORD_TYPES[kind]) {
      const v = m[type]
      if (v !== undefined && isBetter(type, v, running[type])) {
        won.push(type)
        running[type] = v
      }
    }
    if (won.length > 0) result.set(s.id, won)
  }
  return result
}

/** Сколько рекордов в тренировке — для итогов; каждый тип считается один раз. */
export function countRecords(
  kind: ExerciseKind,
  history: Bests,
  sets: readonly WorkoutSet[],
): number {
  const types = new Set<RecordType>()
  for (const won of recordSets(kind, history, sets).values()) for (const t of won) types.add(t)
  return types.size
}

/**
 * Таблица повторных максимумов: лучший вес, поднятый хотя бы N раз.
 * Если пожал 100 × 5, то и на 3 повтора рекорд не меньше 100.
 */
export function repMaxes(sets: readonly WorkoutSet[], maxReps = 10): (number | undefined)[] {
  const best: (number | undefined)[] = Array.from({ length: maxReps }, () => undefined)
  for (const s of sets) {
    if (!counts('strength', s)) continue
    const w = s.weight ?? 0
    const r = s.reps ?? 0
    if (w <= 0) continue
    for (let n = 1; n <= Math.min(r, maxReps); n++) {
      const cur = best[n - 1]
      if (cur === undefined || w > cur) best[n - 1] = w
    }
  }
  return best
}
