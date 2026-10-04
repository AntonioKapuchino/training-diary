/** Группа мышц — ключ хранится в базе, подпись берётся из MUSCLE_LABEL. */
export type MuscleGroup =
  'chest' | 'back' | 'legs' | 'shoulders' | 'biceps' | 'triceps' | 'core' | 'cardio' | 'other'

/**
 * Как считается упражнение:
 *  - strength   — вес × повторы (жим, тяга, присед);
 *  - bodyweight — свой вес: повторы и, если есть, отягощение (подтягивания, брусья);
 *  - timed      — на время (планка, вис);
 *  - cardio     — время и дистанция (дорожка, велосипед).
 */
export type ExerciseKind = 'strength' | 'bodyweight' | 'timed' | 'cardio'

export type Equipment =
  'barbell' | 'dumbbell' | 'machine' | 'cable' | 'bodyweight' | 'kettlebell' | 'band' | 'other'

/** Тип подхода: разминочные не идут в объём и рекорды. */
export type SetType = 'warmup' | 'normal' | 'drop' | 'failure'

export type SetField = 'weight' | 'reps' | 'seconds' | 'distance'

export interface Exercise {
  id: string
  name: string
  muscle: MuscleGroup
  kind: ExerciseKind
  equipment: Equipment
  /** Постоянная заметка: положение сиденья, хват и т. п. */
  note?: string
  /** Отдых между подходами по умолчанию, секунды. */
  restSec?: number
  /** Создано пользователем, а не взято из встроенного каталога. */
  custom: boolean
  /** Упражнение в архиве: скрыто из выбора, но история сохраняется. */
  archivedAt?: number
  createdAt: number
  updatedAt: number
}

export interface WorkoutSet {
  id: string
  type: SetType
  /** Вес, кг. Для упражнений со своим весом — отягощение. */
  weight?: number
  reps?: number
  seconds?: number
  /** Дистанция, км. */
  distance?: number
  done: boolean
  doneAt?: number
}

export type WorkoutStatus = 'active' | 'done'

export interface WorkoutSummary {
  exercises: number
  /** Выполненные рабочие подходы (без разминки). */
  sets: number
  /** Силовой объём: сумма вес × повторы по рабочим подходам, кг. */
  volume: number
  reps: number
  /** Группы мышц по убыванию числа подходов. */
  muscles: MuscleGroup[]
  /** Сколько личных рекордов поставлено. */
  records: number
}

export interface Workout {
  id: string
  status: WorkoutStatus
  /** Локальная дата начала, YYYY-MM-DD. */
  date: string
  startedAt: number
  finishedAt?: number
  title?: string
  templateId?: string
  note?: string
  /** Самочувствие от 1 до 5. */
  rating?: number
  /** Кэш итогов: считается при завершении и после правок. */
  summary?: WorkoutSummary
  createdAt: number
  updatedAt: number
}

/** Упражнение внутри тренировки со своими подходами. */
export interface WorkoutEntry {
  id: string
  workoutId: string
  exerciseId: string
  /** Копия startedAt тренировки — для истории упражнения по индексу [exerciseId+startedAt]. */
  startedAt: number
  order: number
  sets: WorkoutSet[]
  note?: string
  restSec?: number
  updatedAt: number
}

export interface TemplateSet {
  type: SetType
  weight?: number
  reps?: number
  seconds?: number
  distance?: number
}

export interface TemplateExercise {
  id: string
  exerciseId: string
  sets: TemplateSet[]
  restSec?: number
  note?: string
}

/** Программа (шаблон тренировки). */
export interface Template {
  id: string
  name: string
  note?: string
  exercises: TemplateExercise[]
  order: number
  lastUsedAt?: number
  createdAt: number
  updatedAt: number
}

/** Замер тела: вес и, по желанию, обхваты. */
export interface BodyLog {
  id: string
  date: string
  weight?: number
  bodyFat?: number
  waist?: number
  chest?: number
  hips?: number
  arms?: number
  note?: string
  createdAt: number
  updatedAt: number
}

export interface MetaRecord {
  key: string
  value: unknown
}
