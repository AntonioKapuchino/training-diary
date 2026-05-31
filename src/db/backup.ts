import { db } from './db'
import type { Exercise, Workout, WorkoutEntry, Template } from './types'
import { todayISO } from '../lib/date'

export interface BackupData {
  app: 'training-diary'
  version: number
  exportedAt: string
  exercises: Exercise[]
  workouts: Workout[]
  entries: WorkoutEntry[]
  templates: Template[]
}

export async function collectBackup(): Promise<BackupData> {
  const [exercises, workouts, entries, templates] = await Promise.all([
    db.exercises.toArray(),
    db.workouts.toArray(),
    db.entries.toArray(),
    db.templates.toArray(),
  ])
  return {
    app: 'training-diary',
    version: 1,
    exportedAt: new Date().toISOString(),
    exercises, workouts, entries, templates,
  }
}

/** Скачать бэкап файлом. На iPhone Safari предложит сохранить в «Файлы». */
export async function downloadBackup() {
  const data = await collectBackup()
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `тренировки-${todayISO()}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

export interface ImportSummary {
  workouts: number
  entries: number
  exercises: number
  templates: number
}

function isValid(d: any): d is BackupData {
  return d && d.app === 'training-diary' && Array.isArray(d.workouts) && Array.isArray(d.entries)
}

/** Заменить все данные содержимым бэкапа. IDs сохраняются — связи не ломаются. */
export async function restoreBackup(json: string): Promise<ImportSummary> {
  const data = JSON.parse(json)
  if (!isValid(data)) throw new Error('Файл не похож на бэкап дневника тренировок')

  await db.transaction('rw', db.exercises, db.workouts, db.entries, db.templates, async () => {
    await Promise.all([
      db.exercises.clear(), db.workouts.clear(), db.entries.clear(), db.templates.clear(),
    ])
    if (data.exercises?.length) await db.exercises.bulkAdd(data.exercises)
    if (data.workouts?.length) await db.workouts.bulkAdd(data.workouts)
    if (data.entries?.length) await db.entries.bulkAdd(data.entries)
    if (data.templates?.length) await db.templates.bulkAdd(data.templates)
  })

  return {
    workouts: data.workouts?.length ?? 0,
    entries: data.entries?.length ?? 0,
    exercises: data.exercises?.length ?? 0,
    templates: data.templates?.length ?? 0,
  }
}
