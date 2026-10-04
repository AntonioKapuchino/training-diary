import { readFileSync } from 'node:fs'
import type { BrowserContext, Page } from '@playwright/test'

export const legacyBackupPath = new URL('./fixtures/legacy-backup.json', import.meta.url).pathname

/** Бэкап первой версии: шесть тренировок с 21 сентября по 2 октября 2026. */
export const legacyBackup = JSON.parse(readFileSync(legacyBackupPath, 'utf8')) as {
  workouts: unknown[]
  entries: unknown[]
  exercises: unknown[]
  templates: unknown[]
}

/** «Сегодня» для тестов — воскресенье после последней тренировки фикстуры. */
export const TODAY = new Date('2026-10-04T12:00:00+03:00')

export async function fixToday(page: Page): Promise<void> {
  await page.clock.setFixedTime(TODAY)
}

/** База первой версии (Dexie v2 = IndexedDB 20) — до первого запуска новой. */
export async function seedLegacyDatabase(page: Page): Promise<void> {
  await page.goto('/favicon.svg')
  await page.evaluate(async (data) => {
    await new Promise<void>((resolve, reject) => {
      const stores = ['exercises', 'workouts', 'entries', 'templates'] as const
      const req = indexedDB.open('training-diary', 20)
      req.onupgradeneeded = () => {
        for (const s of stores)
          req.result.createObjectStore(s, { keyPath: 'id', autoIncrement: true })
      }
      req.onerror = () => {
        reject(req.error ?? new Error('open failed'))
      }
      req.onsuccess = () => {
        const db = req.result
        const tx = db.transaction([...stores], 'readwrite')
        for (const s of stores) for (const row of data[s]) tx.objectStore(s).put(row)
        tx.oncomplete = () => {
          db.close()
          resolve()
        }
        tx.onerror = () => {
          reject(tx.error ?? new Error('tx failed'))
        }
      }
    })
  }, legacyBackup)
}

/** Количество записей в хранилище новой базы. */
export async function countRows(page: Page, store: string): Promise<number> {
  return page.evaluate(
    (name) =>
      new Promise<number>((resolve) => {
        const req = indexedDB.open('training-diary-v3')
        req.onsuccess = () => {
          const q = req.result.transaction(name).objectStore(name).count()
          q.onsuccess = () => {
            req.result.close()
            resolve(q.result)
          }
        }
      }),
    store,
  )
}

/** Вырезы iPhone: в эмуляции env(safe-area-inset-*) всегда ноль. */
export async function simulateNotch(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      const style = document.createElement('style')
      style.textContent = ':root{--safe-top:59px!important;--safe-bottom:34px!important}'
      document.head.append(style)
    })
  })
}
