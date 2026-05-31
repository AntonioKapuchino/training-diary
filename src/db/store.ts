import { db } from './db'
import type {
  Exercise, MuscleGroup, ExerciseKind, WorkoutEntry, SetEntry,
  Template, TemplateExercise, ProgressPoint,
} from './types'
import { defaultSet } from '../lib/exerciseKind'
import { todayISO } from '../lib/date'

/* ---------- Упражнения ---------- */

export async function addExercise(name: string, group: MuscleGroup, kind: ExerciseKind): Promise<number> {
  return db.exercises.add({ name: name.trim(), group, kind, isCustom: true })
}

export async function deleteExercise(id: number) {
  await db.exercises.delete(id)
}

/* ---------- Тренировки ---------- */

export async function getOrCreateWorkout(date: string): Promise<number> {
  const existing = await db.workouts.where('date').equals(date).first()
  if (existing?.id) return existing.id
  return db.workouts.add({ date, createdAt: Date.now() })
}

export async function setWorkoutNote(workoutId: number, note: string) {
  await db.workouts.update(workoutId, { note })
}

export async function deleteWorkout(workoutId: number) {
  await db.transaction('rw', db.workouts, db.entries, async () => {
    await db.entries.where('workoutId').equals(workoutId).delete()
    await db.workouts.delete(workoutId)
  })
}

/* ---------- Записи упражнений ---------- */

export async function addEntry(
  workoutId: number,
  exercise: Exercise,
  sets?: SetEntry[],
): Promise<number> {
  const count = await db.entries.where('workoutId').equals(workoutId).count()
  return db.entries.add({
    workoutId,
    exerciseId: exercise.id!,
    exerciseName: exercise.name,
    group: exercise.group,
    kind: exercise.kind,
    sets: sets ?? [defaultSet(exercise.kind)],
    order: count,
  })
}

export async function updateEntry(id: number, patch: Partial<WorkoutEntry>) {
  await db.entries.update(id, patch)
}

export async function deleteEntry(id: number) {
  await db.entries.delete(id)
}

/* ---------- Шаблоны ---------- */

export async function saveTemplateFromWorkout(name: string, entries: WorkoutEntry[]): Promise<number> {
  const exercises: TemplateExercise[] = entries.map((e) => ({
    exerciseId: e.exerciseId,
    exerciseName: e.exerciseName,
    group: e.group,
    kind: e.kind,
    sets: e.sets.map((s) => ({ ...s })),
  }))
  return db.templates.add({ name: name.trim(), exercises, createdAt: Date.now() })
}

export async function deleteTemplate(id: number) {
  await db.templates.delete(id)
}

export async function applyTemplate(template: Template, date = todayISO()): Promise<number> {
  const workoutId = await getOrCreateWorkout(date)
  let order = await db.entries.where('workoutId').equals(workoutId).count()
  for (const ex of template.exercises) {
    await db.entries.add({
      workoutId,
      exerciseId: ex.exerciseId,
      exerciseName: ex.exerciseName,
      group: ex.group,
      kind: ex.kind ?? 'strength',
      sets: ex.sets.map((s) => ({ ...s })),
      order: order++,
    })
  }
  return workoutId
}

/* ---------- Прогресс / статистика ---------- */

export async function exerciseProgress(exerciseId: number): Promise<ProgressPoint[]> {
  const entries = await db.entries.where('exerciseId').equals(exerciseId).toArray()
  const byWorkout = new Map<number, WorkoutEntry[]>()
  for (const e of entries) {
    const arr = byWorkout.get(e.workoutId) ?? []
    arr.push(e)
    byWorkout.set(e.workoutId, arr)
  }
  const points: ProgressPoint[] = []
  for (const [workoutId, list] of byWorkout) {
    const workout = await db.workouts.get(workoutId)
    if (!workout) continue
    const p: ProgressPoint = {
      date: workout.date,
      maxWeight: 0, totalVolume: 0,
      maxReps: 0, totalReps: 0,
      maxSeconds: 0, totalSeconds: 0,
      maxDistance: 0, totalDistance: 0,
    }
    for (const e of list) {
      for (const s of e.sets) {
        const reps = s.reps || 0, weight = s.weight || 0
        const sec = s.seconds || 0, dist = s.distance || 0
        p.totalVolume += reps * weight
        p.totalReps += reps
        p.totalSeconds += sec
        p.totalDistance += dist
        if (weight > p.maxWeight) p.maxWeight = weight
        if (reps > p.maxReps) p.maxReps = reps
        if (sec > p.maxSeconds) p.maxSeconds = sec
        if (dist > p.maxDistance) p.maxDistance = dist
      }
    }
    points.push(p)
  }
  return points.sort((a, b) => a.date.localeCompare(b.date))
}

/** Запись по упражнению из предыдущей (более ранней) тренировки — для подсказки «прошлый раз». */
export async function previousEntryFor(
  exerciseId: number,
  beforeDate: string,
): Promise<{ entry: WorkoutEntry; date: string } | undefined> {
  const entries = await db.entries.where('exerciseId').equals(exerciseId).toArray()
  let best: { entry: WorkoutEntry; date: string } | undefined
  for (const e of entries) {
    const w = await db.workouts.get(e.workoutId)
    if (!w) continue
    if (w.date < beforeDate && (!best || w.date > best.date)) best = { entry: e, date: w.date }
  }
  return best
}

/** Последняя запись по упражнению — чтобы подставлять прошлые подходы. */
export async function lastEntryFor(exerciseId: number): Promise<WorkoutEntry | undefined> {
  const entries = await db.entries.where('exerciseId').equals(exerciseId).toArray()
  if (entries.length === 0) return undefined
  let best: { entry: WorkoutEntry; date: string } | undefined
  for (const e of entries) {
    const w = await db.workouts.get(e.workoutId)
    if (!w) continue
    if (!best || w.date.localeCompare(best.date) > 0) best = { entry: e, date: w.date }
  }
  return best?.entry
}

export type { WorkoutEntry, Exercise, Template, ProgressPoint }
