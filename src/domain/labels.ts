import type { Equipment, ExerciseKind, MuscleGroup, SetType } from './types'

export const MUSCLES: readonly MuscleGroup[] = [
  'chest',
  'back',
  'legs',
  'shoulders',
  'biceps',
  'triceps',
  'core',
  'cardio',
  'other',
]

export const MUSCLE_LABEL: Record<MuscleGroup, string> = {
  chest: 'Грудь',
  back: 'Спина',
  legs: 'Ноги',
  shoulders: 'Плечи',
  biceps: 'Бицепс',
  triceps: 'Трицепс',
  core: 'Пресс',
  cardio: 'Кардио',
  other: 'Другое',
}

/** Цвет группы — CSS-переменная, своя для светлой и тёмной темы. */
export function muscleColor(m: MuscleGroup): string {
  return `var(--m-${m})`
}

export const KINDS: readonly ExerciseKind[] = ['strength', 'bodyweight', 'timed', 'cardio']

export const KIND_LABEL: Record<ExerciseKind, string> = {
  strength: 'Вес и повторы',
  bodyweight: 'Свой вес',
  timed: 'На время',
  cardio: 'Кардио',
}

export const KIND_HINT: Record<ExerciseKind, string> = {
  strength: 'Штанга, гантели, тренажёры',
  bodyweight: 'Повторы, можно с отягощением',
  timed: 'Планка, вис, статика',
  cardio: 'Время и дистанция',
}

export const EQUIPMENT: readonly Equipment[] = [
  'barbell',
  'dumbbell',
  'machine',
  'cable',
  'bodyweight',
  'kettlebell',
  'band',
  'other',
]

export const EQUIPMENT_LABEL: Record<Equipment, string> = {
  barbell: 'Штанга',
  dumbbell: 'Гантели',
  machine: 'Тренажёр',
  cable: 'Блок',
  bodyweight: 'Свой вес',
  kettlebell: 'Гиря',
  band: 'Резина',
  other: 'Другое',
}

export const SET_TYPES: readonly SetType[] = ['warmup', 'normal', 'drop', 'failure']

export const SET_TYPE_LABEL: Record<SetType, string> = {
  warmup: 'Разминка',
  normal: 'Рабочий',
  drop: 'Дроп-сет',
  failure: 'До отказа',
}

/** Буква в кружке номера подхода; у рабочих — номер. */
export const SET_TYPE_BADGE: Record<SetType, string> = {
  warmup: 'Р',
  normal: '',
  drop: 'Д',
  failure: 'О',
}
