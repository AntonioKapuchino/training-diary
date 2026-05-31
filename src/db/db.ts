import Dexie, { type Table } from 'dexie'
import type { Exercise, Workout, WorkoutEntry, Template, MuscleGroup, ExerciseKind } from './types'

export class DiaryDB extends Dexie {
  exercises!: Table<Exercise, number>
  workouts!: Table<Workout, number>
  entries!: Table<WorkoutEntry, number>
  templates!: Table<Template, number>

  constructor() {
    super('training-diary')
    this.version(1).stores({
      exercises: '++id, name, group, isCustom',
      workouts: '++id, date, createdAt',
      entries: '++id, workoutId, exerciseId, order',
      templates: '++id, name, createdAt',
    })
    // v2: добавлен тип учёта (kind) у упражнений
    this.version(2).stores({
      exercises: '++id, name, group, kind, isCustom',
      workouts: '++id, date, createdAt',
      entries: '++id, workoutId, exerciseId, order',
      templates: '++id, name, createdAt',
    }).upgrade(async (tx) => {
      await tx.table('exercises').toCollection().modify((ex: Exercise) => {
        if (!ex.kind) ex.kind = KIND_BY_NAME[ex.name] ?? 'strength'
      })
      await tx.table('entries').toCollection().modify((e: WorkoutEntry) => {
        if (!e.kind) e.kind = KIND_BY_NAME[e.exerciseName] ?? 'strength'
      })
    })
  }
}

export const db = new DiaryDB()

/** Базовый каталог: [название, группа, тип учёта] */
const SEED: Array<[string, MuscleGroup, ExerciseKind]> = [
  ['Жим лёжа', 'Грудь', 'strength'],
  ['Жим гантелей на наклонной', 'Грудь', 'strength'],
  ['Разводка гантелей', 'Грудь', 'strength'],
  ['Сведение в кроссовере', 'Грудь', 'strength'],
  ['Отжимания на брусьях', 'Грудь', 'bodyweight'],

  ['Подтягивания', 'Спина', 'bodyweight'],
  ['Вертикальная тяга блока', 'Спина', 'strength'],
  ['Горизонтальная тяга блока', 'Спина', 'strength'],
  ['Тяга штанги в наклоне', 'Спина', 'strength'],
  ['Становая тяга', 'Спина', 'strength'],

  ['Приседания со штангой', 'Ноги', 'strength'],
  ['Жим ногами', 'Ноги', 'strength'],
  ['Разгибание ног', 'Ноги', 'strength'],
  ['Сгибание ног', 'Ноги', 'strength'],
  ['Выпады', 'Ноги', 'strength'],
  ['Подъём на носки', 'Ноги', 'strength'],

  ['Жим штанги стоя', 'Плечи', 'strength'],
  ['Жим гантелей сидя', 'Плечи', 'strength'],
  ['Махи гантелями в стороны', 'Плечи', 'strength'],
  ['Подъём гантелей перед собой', 'Плечи', 'strength'],

  ['Штанга на бицепс', 'Бицепс', 'strength'],
  ['Подъём гантелей на бицепс', 'Бицепс', 'strength'],
  ['Молотки', 'Бицепс', 'strength'],

  ['Французский жим', 'Трицепс', 'strength'],
  ['Разгибания рук на блоке', 'Трицепс', 'strength'],
  ['Отжимания узким хватом', 'Трицепс', 'bodyweight'],

  ['Пресс под градусом', 'Пресс', 'bodyweight'],
  ['Скручивания', 'Пресс', 'bodyweight'],
  ['Подъём ног в висе', 'Пресс', 'bodyweight'],
  ['Планка', 'Пресс', 'timed'],

  ['Беговая дорожка', 'Кардио', 'cardio'],
  ['Велотренажёр', 'Кардио', 'cardio'],
  ['Эллипс', 'Кардио', 'cardio'],
]

const KIND_BY_NAME: Record<string, ExerciseKind> = Object.fromEntries(
  SEED.map(([name, , kind]) => [name, kind])
)

export async function ensureSeed() {
  const count = await db.exercises.count()
  if (count > 0) return
  await db.exercises.bulkAdd(
    SEED.map(([name, group, kind]) => ({ name, group, kind, isCustom: false }))
  )
}
