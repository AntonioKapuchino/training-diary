import { newId } from '@/domain/ids'
import type { BodyLog } from '@/domain/types'
import { db } from './db'

export type BodyInput = Partial<Omit<BodyLog, 'id' | 'createdAt' | 'updatedAt'>> & {
  id?: string
  date: string
}

const MEASURES = ['weight', 'bodyFat', 'waist', 'chest', 'hips', 'arms'] as const

/**
 * Один замер на дату: повторная запись за тот же день обновляет прежнюю. Ключ во входе
 * со значением undefined — поле стёрли, и оно удаляется; ключа нет — остаётся как было.
 * Если замер перенесли на дату, где уже есть другой, они сливаются в один: значения
 * из правки главнее, остальное берётся из того, что уже был на эту дату.
 */
export async function saveBodyLog(input: BodyInput): Promise<string> {
  return db.transaction('rw', db.bodyLogs, async () => {
    const now = Date.now()
    const existing = input.id
      ? await db.bodyLogs.get(input.id)
      : await db.bodyLogs.where('date').equals(input.date).first()
    const sameDate = (await db.bodyLogs.where('date').equals(input.date).toArray()).filter(
      (l) => l.id !== existing?.id,
    )
    const other = sameDate[0]
    const log: BodyLog = {
      id: existing?.id ?? newId(),
      date: input.date,
      createdAt: existing?.createdAt ?? other?.createdAt ?? now,
      updatedAt: now,
    }
    for (const k of MEASURES) {
      const v = k in input ? input[k] : existing?.[k]
      const value = v ?? other?.[k]
      if (value !== undefined && value > 0) log[k] = value
    }
    const own = ('note' in input ? input.note : existing?.note)?.trim()
    const note = own !== undefined && own !== '' ? own : other?.note?.trim()
    if (note) log.note = note
    if (sameDate.length > 0) await db.bodyLogs.bulkDelete(sameDate.map((l) => l.id))
    await db.bodyLogs.put(log)
    return log.id
  })
}

export async function deleteBodyLog(id: string): Promise<BodyLog | undefined> {
  const log = await db.bodyLogs.get(id)
  if (log) await db.bodyLogs.delete(id)
  return log
}

export async function restoreBodyLog(log: BodyLog): Promise<void> {
  await db.bodyLogs.put(log)
}
