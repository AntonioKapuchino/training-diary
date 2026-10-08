import type { Exercise } from '@/domain/types'
import { CATALOG } from './catalog'
import { db } from './db'

/**
 * Добавляет недостающие упражнения встроенного каталога. Существующие не трогает:
 * пользователь мог поменять им заметку или отдых.
 */
export async function ensureCatalog(now = Date.now()): Promise<void> {
  // Чтение и запись в одной транзакции: две вкладки, стартующие разом,
  // иначе обе добавили бы одно и то же, и вторая упала бы на дубле ключа.
  await db.transaction('rw', db.exercises, async () => {
    const existing = new Set(await db.exercises.toCollection().primaryKeys())
    const missing: Exercise[] = CATALOG.filter((c) => !existing.has(c.id)).map((c) => ({
      ...c,
      custom: false,
      createdAt: now,
      updatedAt: now,
    }))
    if (missing.length > 0) await db.exercises.bulkAdd(missing)
  })
}
