import { Dexie, type EntityTable } from 'dexie'
import type { BodyLog, Exercise, MetaRecord, Template, Workout, WorkoutEntry } from '@/domain/types'
import type { BackupV2 } from './backup-format'

export type SnapshotReason = 'auto' | 'before-import' | 'before-restore' | 'before-migration'

/** Резервная копия внутри приложения: страхует от ошибок вроде случайного импорта. */
export interface Snapshot {
  id: string
  createdAt: number
  reason: SnapshotReason
  workouts: number
  data: BackupV2
}

/**
 * Новая база. Первая версия жила в «training-diary» с числовыми id; её не трогаем,
 * а переносим данные отсюда (см. legacy.ts) — старая база остаётся как запасная копия.
 */
export const DB_NAME = 'training-diary-v3'

export class TrainingDB extends Dexie {
  exercises!: EntityTable<Exercise, 'id'>
  workouts!: EntityTable<Workout, 'id'>
  entries!: EntityTable<WorkoutEntry, 'id'>
  templates!: EntityTable<Template, 'id'>
  bodyLogs!: EntityTable<BodyLog, 'id'>
  snapshots!: EntityTable<Snapshot, 'id'>
  meta!: EntityTable<MetaRecord, 'key'>

  constructor(name = DB_NAME) {
    super(name)
    this.version(1).stores({
      exercises: 'id, name, muscle',
      workouts: 'id, status, date, startedAt, [status+startedAt]',
      entries: 'id, workoutId, exerciseId, [exerciseId+startedAt]',
      templates: 'id, order',
      bodyLogs: 'id, date',
      snapshots: 'id, createdAt',
      meta: 'key',
    })
  }
}

export const db = new TrainingDB()

export async function getMeta<T>(key: string): Promise<T | undefined> {
  const row = await db.meta.get(key)
  return row?.value as T | undefined
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  await db.meta.put({ key, value })
}
