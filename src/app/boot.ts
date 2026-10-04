import { autoSnapshot } from '@/db/backup'
import { db } from '@/db/db'
import { migrateLegacy, type MigrationState } from '@/db/migrate'
import { ensureCatalog } from '@/db/seed'
import { requestPersistence } from '@/lib/storage'

export interface BootResult {
  migration: MigrationState
}

let booting: Promise<BootResult> | null = null

/**
 * Запуск: открыть базу, дополнить каталог, перенести данные первой версии.
 * Остальное (снимок, просьба о постоянном хранилище) — в фоне, интерфейс не ждёт.
 */
export function boot(): Promise<BootResult> {
  booting ??= (async () => {
    await db.open()
    await ensureCatalog()
    const migration = await migrateLegacy()
    void requestPersistence()
    void autoSnapshot().catch(() => undefined)
    return { migration }
  })()
  return booting
}
