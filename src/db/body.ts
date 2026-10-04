import { newId } from '@/domain/ids'
import type { BodyLog } from '@/domain/types'
import { db } from './db'

export type BodyInput = Partial<Omit<BodyLog, 'id' | 'createdAt' | 'updatedAt'>> & {
  id?: string
  date: string
}

const MEASURES = ['weight', 'bodyFat', 'waist', 'chest', 'hips', 'arms'] as const

/** Один замер на дату: повторная запись за тот же день обновляет прежнюю. */
export async function saveBodyLog(input: BodyInput): Promise<string> {
  const now = Date.now()
  const existing = input.id
    ? await db.bodyLogs.get(input.id)
    : await db.bodyLogs.where('date').equals(input.date).first()
  const log: BodyLog = {
    id: existing?.id ?? newId(),
    date: input.date,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  }
  for (const k of MEASURES) {
    const v = k in input ? input[k] : existing?.[k]
    if (v !== undefined && v > 0) log[k] = v
  }
  const note = (input.note ?? existing?.note)?.trim()
  if (note) log.note = note
  await db.bodyLogs.put(log)
  return log.id
}

export async function deleteBodyLog(id: string): Promise<BodyLog | undefined> {
  const log = await db.bodyLogs.get(id)
  if (log) await db.bodyLogs.delete(id)
  return log
}

export async function restoreBodyLog(log: BodyLog): Promise<void> {
  await db.bodyLogs.put(log)
}
