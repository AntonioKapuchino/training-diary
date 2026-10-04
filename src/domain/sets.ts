import { newId } from './ids'
import type { ExerciseKind, SetField, SetType, TemplateSet, WorkoutSet } from './types'

export interface FieldSpec {
  field: SetField
  /** Заголовок колонки. */
  label: string
  /** Название поля для клавиатуры и экранного диктора. */
  title: string
  unit: string
  /** Шаг кнопок «−» и «+». Для веса берётся из настроек. */
  step: number
  /** Сколько знаков после запятой можно ввести. */
  decimals: number
  /** Ввод как у таймера: цифры заполняют «м:сс» справа. */
  duration?: boolean
}

const WEIGHT: FieldSpec = {
  field: 'weight',
  label: 'кг',
  title: 'Вес',
  unit: 'кг',
  step: 2.5,
  decimals: 2,
}
const ADDED: FieldSpec = { ...WEIGHT, label: '+кг', title: 'Отягощение' }
const REPS: FieldSpec = {
  field: 'reps',
  label: 'Повт',
  title: 'Повторы',
  unit: 'повт.',
  step: 1,
  decimals: 0,
}
const TIME: FieldSpec = {
  field: 'seconds',
  label: 'Время',
  title: 'Время',
  unit: '',
  step: 15,
  decimals: 0,
  duration: true,
}
const DIST: FieldSpec = {
  field: 'distance',
  label: 'км',
  title: 'Дистанция',
  unit: 'км',
  step: 0.5,
  decimals: 2,
}

export function fieldsFor(kind: ExerciseKind): readonly FieldSpec[] {
  switch (kind) {
    case 'strength':
      return [WEIGHT, REPS]
    case 'bodyweight':
      return [ADDED, REPS]
    case 'timed':
      return [TIME]
    case 'cardio':
      return [{ ...TIME, step: 60 }, DIST]
  }
}

export function isWorking(s: { type: SetType }): boolean {
  return s.type !== 'warmup'
}

type SetValues = Pick<WorkoutSet, 'weight' | 'reps' | 'seconds' | 'distance'>

/** Заполнено ли главное поле подхода — без него подход не засчитывается. */
export function isComplete(kind: ExerciseKind, s: SetValues): boolean {
  switch (kind) {
    case 'strength':
    case 'bodyweight':
      return (s.reps ?? 0) > 0
    case 'timed':
      return (s.seconds ?? 0) > 0
    case 'cardio':
      return (s.seconds ?? 0) > 0 || (s.distance ?? 0) > 0
  }
}

/** Выполненный рабочий подход с заполненными полями — только такие идут в статистику. */
export function counts(kind: ExerciseKind, s: WorkoutSet): boolean {
  return s.done && isWorking(s) && isComplete(kind, s)
}

export function setVolume(kind: ExerciseKind, s: SetValues): number {
  return kind === 'strength' ? (s.weight ?? 0) * (s.reps ?? 0) : 0
}

/** Только заданные значения, без undefined — чтобы не затирать поля при слиянии. */
export function pickValues(s: Partial<SetValues>): SetValues {
  const out: SetValues = {}
  if (s.weight !== undefined) out.weight = s.weight
  if (s.reps !== undefined) out.reps = s.reps
  if (s.seconds !== undefined) out.seconds = s.seconds
  if (s.distance !== undefined) out.distance = s.distance
  return out
}

export function hasAnyValue(s: SetValues): boolean {
  return (s.weight ?? 0) > 0 || (s.reps ?? 0) > 0 || (s.seconds ?? 0) > 0 || (s.distance ?? 0) > 0
}

export function makeSet(from: Partial<TemplateSet> = {}): WorkoutSet {
  return { id: newId(), type: from.type ?? 'normal', ...pickValues(from), done: false }
}

export function toTemplateSet(s: WorkoutSet): TemplateSet {
  return { type: s.type, ...pickValues(s) }
}

/** Сколько пустых подходов добавить, если упражнение делается впервые. */
export function defaultSetCount(kind: ExerciseKind): number {
  return kind === 'cardio' ? 1 : kind === 'timed' ? 2 : 3
}
