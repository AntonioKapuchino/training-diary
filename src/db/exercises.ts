import { newId } from '@/domain/ids'
import { sameName } from '@/domain/search'
import type { Equipment, Exercise, ExerciseKind, MuscleGroup } from '@/domain/types'
import { db } from './db'
import { recomputeAllSummaries } from './summaries'

export class NameTakenError extends Error {
  constructor(readonly existing: Exercise) {
    super(`Упражнение «${existing.name}» уже есть`)
    this.name = 'NameTakenError'
  }
}

export interface ExerciseInput {
  name: string
  muscle: MuscleGroup
  kind: ExerciseKind
  equipment: Equipment
  note?: string
  restSec?: number | null
}

export async function findByName(name: string, exceptId?: string): Promise<Exercise | undefined> {
  const all = await db.exercises.toArray()
  return all.find((e) => e.id !== exceptId && sameName(e.name, name))
}

export async function createExercise(input: ExerciseInput): Promise<string> {
  const name = input.name.trim()
  const taken = await findByName(name)
  if (taken) throw new NameTakenError(taken)
  const now = Date.now()
  const ex: Exercise = {
    id: newId(),
    name,
    muscle: input.muscle,
    kind: input.kind,
    equipment: input.equipment,
    custom: true,
    createdAt: now,
    updatedAt: now,
  }
  const note = input.note?.trim()
  if (note) ex.note = note
  if (input.restSec != null) ex.restSec = input.restSec
  await db.exercises.add(ex)
  return ex.id
}

export interface ExerciseUsage {
  sessions: number
  templates: number
}

export async function exerciseUsage(id: string): Promise<ExerciseUsage> {
  const entries = await db.entries.where('exerciseId').equals(id).toArray()
  const templates = await db.templates.toArray()
  return {
    sessions: new Set(entries.map((e) => e.workoutId)).size,
    templates: templates.filter((t) => t.exercises.some((x) => x.exerciseId === id)).length,
  }
}

/**
 * Правка упражнения. Тип учёта меняется только у упражнения без истории:
 * иначе старые подходы потеряют смысл (вес × повторы станут «временем»).
 */
export async function updateExercise(id: string, patch: Partial<ExerciseInput>): Promise<void> {
  const ex = await db.exercises.get(id)
  if (!ex) return
  const next: Exercise = { ...ex, updatedAt: Date.now() }
  if (patch.name !== undefined) {
    const name = patch.name.trim()
    const taken = await findByName(name, id)
    if (taken) throw new NameTakenError(taken)
    if (name) next.name = name
  }
  if (patch.muscle) next.muscle = patch.muscle
  if (patch.equipment) next.equipment = patch.equipment
  if (patch.kind && patch.kind !== ex.kind) {
    const usage = await exerciseUsage(id)
    if (usage.sessions === 0) next.kind = patch.kind
  }
  if (patch.note !== undefined) {
    const note = patch.note.trim()
    if (note) next.note = note
    else delete next.note
  }
  if (patch.restSec === null) delete next.restSec
  else if (patch.restSec !== undefined) next.restSec = patch.restSec
  await db.exercises.put(next)
  if (patch.muscle && patch.muscle !== ex.muscle) await recomputeAllSummaries()
}

export async function setArchived(id: string, archived: boolean): Promise<void> {
  const ex = await db.exercises.get(id)
  if (!ex) return
  const next: Exercise = { ...ex, updatedAt: Date.now() }
  if (archived) next.archivedAt = Date.now()
  else delete next.archivedAt
  await db.exercises.put(next)
}

/** Удалить можно только своё упражнение без истории; остальное — в архив. */
export async function deleteExercise(id: string): Promise<boolean> {
  const ex = await db.exercises.get(id)
  if (!ex?.custom) return false
  const usage = await exerciseUsage(id)
  if (usage.sessions > 0 || usage.templates > 0) return false
  await db.exercises.delete(id)
  return true
}

/**
 * Объединить дубль с основным упражнением: история и программы переходят к `targetId`.
 * Свой дубль удаляется, встроенный — уходит в архив.
 */
export async function mergeExercises(sourceId: string, targetId: string): Promise<void> {
  if (sourceId === targetId) return
  await db.transaction('rw', [db.exercises, db.entries, db.templates], async () => {
    const [source, target] = await db.exercises.bulkGet([sourceId, targetId])
    if (!source || !target) return
    if (source.kind !== target.kind) return
    const now = Date.now()
    await db.entries
      .where('exerciseId')
      .equals(sourceId)
      .modify({ exerciseId: targetId, updatedAt: now })
    const templates = await db.templates.toArray()
    for (const t of templates) {
      if (!t.exercises.some((x) => x.exerciseId === sourceId)) continue
      await db.templates.put({
        ...t,
        exercises: t.exercises.map((x) =>
          x.exerciseId === sourceId ? { ...x, exerciseId: targetId } : x,
        ),
        updatedAt: now,
      })
    }
    if (source.custom) await db.exercises.delete(sourceId)
    else await db.exercises.put({ ...source, archivedAt: now, updatedAt: now })
  })
  await recomputeAllSummaries()
}
