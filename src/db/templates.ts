import { newId } from '@/domain/ids'
import { toTemplateSet } from '@/domain/sets'
import type { Template, TemplateExercise } from '@/domain/types'
import { db } from './db'

export async function createTemplate(
  name: string,
  exercises: TemplateExercise[] = [],
): Promise<string> {
  const now = Date.now()
  const last = await db.templates.orderBy('order').last()
  const t: Template = {
    id: newId(),
    name: name.trim() || 'Новая программа',
    exercises,
    order: (last?.order ?? -1) + 1,
    createdAt: now,
    updatedAt: now,
  }
  await db.templates.add(t)
  return t.id
}

/** Состав тренировки как программа: упражнения, подходы и веса. */
async function exercisesOfWorkout(workoutId: string): Promise<TemplateExercise[]> {
  const entries = await db.entries.where('workoutId').equals(workoutId).sortBy('order')
  return entries.map((e) => {
    const done = e.sets.filter((s) => s.done)
    const item: TemplateExercise = {
      id: newId(),
      exerciseId: e.exerciseId,
      sets: (done.length > 0 ? done : e.sets).map(toTemplateSet),
    }
    if (e.restSec !== undefined) item.restSec = e.restSec
    return item
  })
}

export async function templateFromWorkout(workoutId: string, name: string): Promise<string> {
  return createTemplate(name, await exercisesOfWorkout(workoutId))
}

/**
 * Обновить программу тем, что получилось на тренировке, ничего не потеряв:
 * у сделанных упражнений — новые подходы и веса, пропущенные остаются как были,
 * добавленные на тренировке — в конец.
 */
export async function updateTemplateFromWorkout(
  templateId: string,
  workoutId: string,
): Promise<void> {
  const t = await db.templates.get(templateId)
  if (!t) return
  const entries = await db.entries.where('workoutId').equals(workoutId).sortBy('order')
  const fresh = new Map<string, TemplateExercise>()
  for (const e of entries) {
    const done = e.sets.filter((s) => s.done)
    if (done.length === 0 || fresh.has(e.exerciseId)) continue
    fresh.set(e.exerciseId, {
      id: newId(),
      exerciseId: e.exerciseId,
      sets: done.map(toTemplateSet),
      ...(e.restSec !== undefined ? { restSec: e.restSec } : {}),
    })
  }
  if (fresh.size === 0) return
  const merged = t.exercises.map((item) => {
    const f = fresh.get(item.exerciseId)
    if (!f) return item
    fresh.delete(item.exerciseId)
    return { ...item, sets: f.sets, ...(f.restSec !== undefined ? { restSec: f.restSec } : {}) }
  })
  await db.templates.put({ ...t, exercises: [...merged, ...fresh.values()], updatedAt: Date.now() })
}

export async function updateTemplate(
  id: string,
  patch: Partial<Pick<Template, 'name' | 'note' | 'exercises'>>,
): Promise<void> {
  const t = await db.templates.get(id)
  if (!t) return
  const next: Template = { ...t, ...patch, updatedAt: Date.now() }
  if (patch.name !== undefined) next.name = patch.name.trim() || t.name
  if (patch.note !== undefined && !patch.note.trim()) delete next.note
  await db.templates.put(next)
}

export async function deleteTemplate(id: string): Promise<Template | undefined> {
  const t = await db.templates.get(id)
  if (t) await db.templates.delete(id)
  return t
}

export async function restoreTemplate(t: Template): Promise<void> {
  await db.templates.put(t)
}

export async function duplicateTemplate(id: string): Promise<string | undefined> {
  const t = await db.templates.get(id)
  if (!t) return undefined
  return createTemplate(
    `${t.name} (копия)`,
    t.exercises.map((x) => ({ ...x, id: newId(), sets: x.sets.map((s) => ({ ...s })) })),
  )
}

export async function reorderTemplates(orderedIds: readonly string[]): Promise<void> {
  await db.transaction('rw', db.templates, async () => {
    const all = await db.templates.toArray()
    const pos = new Map(orderedIds.map((id, i) => [id, i]))
    await db.templates.bulkPut(all.map((t) => ({ ...t, order: pos.get(t.id) ?? t.order })))
  })
}
