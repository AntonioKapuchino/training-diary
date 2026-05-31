export type MuscleGroup =
  | 'Грудь'
  | 'Спина'
  | 'Ноги'
  | 'Плечи'
  | 'Бицепс'
  | 'Трицепс'
  | 'Пресс'
  | 'Кардио'
  | 'Другое'

export const MUSCLE_GROUPS: MuscleGroup[] = [
  'Грудь',
  'Спина',
  'Ноги',
  'Плечи',
  'Бицепс',
  'Трицепс',
  'Пресс',
  'Кардио',
  'Другое',
]

/**
 * Тип учёта упражнения — определяет, какие поля заполняются в подходах:
 *  - strength   — повторы × вес (кг)        (жим, тяга, присед…)
 *  - bodyweight — свой вес: повторы + доп. вес (подтягивания, отжимания, подъём ног…)
 *  - timed      — на время: мин : сек         (планка, статика)
 *  - cardio     — время + дистанция (км)      (дорожка, велотренажёр…)
 */
export type ExerciseKind = 'strength' | 'bodyweight' | 'timed' | 'cardio'

export const KIND_LABEL: Record<ExerciseKind, string> = {
  strength: 'Вес и повторы',
  bodyweight: 'Свой вес (повторы)',
  timed: 'На время',
  cardio: 'Кардио (время + км)',
}

export interface Exercise {
  id?: number
  name: string
  group: MuscleGroup
  kind: ExerciseKind
  isCustom: boolean
}

/** Один подход. Заполняются только поля, релевантные типу упражнения. */
export interface SetEntry {
  reps?: number
  weight?: number
  /** длительность в секундах (timed/cardio) */
  seconds?: number
  /** дистанция в км (cardio) */
  distance?: number
}

export interface Workout {
  id?: number
  /** Дата в формате YYYY-MM-DD */
  date: string
  /** Общая заметка по тренировке */
  note?: string
  createdAt: number
}

export interface WorkoutEntry {
  id?: number
  workoutId: number
  exerciseId: number
  /** Дублируем имя/группу/тип на момент записи — чтобы история не ломалась при правках */
  exerciseName: string
  group: MuscleGroup
  kind: ExerciseKind
  sets: SetEntry[]
  /** Комментарий к упражнению — ощущения, страховка и т.п. */
  comment?: string
  order: number
}

export interface TemplateExercise {
  exerciseId: number
  exerciseName: string
  group: MuscleGroup
  kind: ExerciseKind
  sets: SetEntry[]
}

export interface Template {
  id?: number
  name: string
  exercises: TemplateExercise[]
  createdAt: number
}

/** Точка прогресса по упражнению — агрегаты за одну тренировку. */
export interface ProgressPoint {
  date: string
  maxWeight: number
  totalVolume: number
  maxReps: number
  totalReps: number
  maxSeconds: number
  totalSeconds: number
  maxDistance: number
  totalDistance: number
}
