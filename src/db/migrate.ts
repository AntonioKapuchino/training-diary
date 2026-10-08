import { CATALOG } from './catalog'
import { db, getMeta, setMeta } from './db'
import { convertLegacy, isEmptyLegacy, readLegacyDatabase, type LegacyReport } from './legacy'

const KEY = 'legacyMigration'

export interface MigrationState {
  at: number
  found: boolean
  report?: LegacyReport
  /** Пользователь уже видел карточку «данные перенесены». */
  seen?: boolean
}

/**
 * Один раз переносит данные первой версии. Повторно не запускается:
 * отметка лежит в meta. Если в новой базе уже есть тренировки, перенос
 * пропускается — иначе получились бы дубли.
 */
export async function migrateLegacy(factory?: IDBFactory): Promise<MigrationState> {
  const done = await getMeta<MigrationState>(KEY)
  if (done) return done

  let legacy
  try {
    legacy = await readLegacyDatabase(factory)
  } catch {
    // Старая база есть, но не прочиталась. Отметку не ставим — попробуем при
    // следующем запуске, иначе её данные остались бы недоступны навсегда.
    return { at: Date.now(), found: false }
  }
  const hasNewData = (await db.workouts.count()) > 0
  if (!legacy || isEmptyLegacy(legacy) || hasNewData) {
    const state: MigrationState = { at: Date.now(), found: false }
    await setMeta(KEY, state)
    return state
  }

  const converted = convertLegacy(legacy, CATALOG)
  const state: MigrationState = { at: Date.now(), found: true, report: converted.report }
  // Проверка ещё раз — внутри записи. Две вкладки, открытые разом, читают старую базу
  // параллельно, но пишут по очереди: вторая увидит отметку первой и ничего не задвоит.
  return db.transaction(
    'rw',
    [db.exercises, db.workouts, db.entries, db.templates, db.meta],
    async () => {
      const already = (await db.meta.get(KEY))?.value as MigrationState | undefined
      if (already) return already
      if ((await db.workouts.count()) > 0) {
        const skipped: MigrationState = { at: Date.now(), found: false }
        await db.meta.put({ key: KEY, value: skipped })
        return skipped
      }
      await db.exercises.bulkPut(converted.exercises)
      await db.workouts.bulkAdd(converted.workouts)
      await db.entries.bulkAdd(converted.entries)
      await db.templates.bulkAdd(converted.templates)
      await db.meta.put({ key: KEY, value: state })
      return state
    },
  )
}

export async function markMigrationSeen(): Promise<void> {
  const state = await getMeta<MigrationState>(KEY)
  if (state) await setMeta(KEY, { ...state, seen: true })
}
