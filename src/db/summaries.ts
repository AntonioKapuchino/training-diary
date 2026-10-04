import { addSession, countRecords, emptyBests, type Bests } from '@/domain/records'
import { summarize } from '@/domain/stats'
import type { Exercise, Workout, WorkoutEntry, WorkoutSummary } from '@/domain/types'
import { db } from './db'

type ExerciseFacts = Pick<Exercise, 'kind' | 'muscle'>

/**
 * Итоги всех тренировок за один проход по времени: рекорды считаются
 * относительно того, что было до каждой тренировки.
 */
export function buildSummaries(
  workouts: readonly Workout[],
  entries: readonly WorkoutEntry[],
  exercises: ReadonlyMap<string, ExerciseFacts>,
): Map<string, WorkoutSummary> {
  const byWorkout = new Map<string, WorkoutEntry[]>()
  for (const e of entries) {
    const list = byWorkout.get(e.workoutId)
    if (list) list.push(e)
    else byWorkout.set(e.workoutId, [e])
  }
  const bests = new Map<string, Bests>()
  const result = new Map<string, WorkoutSummary>()
  const ordered = [...workouts]
    .filter((w) => w.status === 'done')
    .sort((a, b) => a.startedAt - b.startedAt)

  for (const w of ordered) {
    const list = (byWorkout.get(w.id) ?? []).sort((a, b) => a.order - b.order)
    let records = 0
    const facts = []
    // Одно упражнение дважды в тренировке — один набор подходов.
    const setsByExercise = new Map<string, WorkoutEntry['sets']>()
    for (const e of list) {
      const ex = exercises.get(e.exerciseId)
      if (!ex) continue
      facts.push({ kind: ex.kind, muscle: ex.muscle, sets: e.sets })
      setsByExercise.set(e.exerciseId, [...(setsByExercise.get(e.exerciseId) ?? []), ...e.sets])
    }
    for (const [exerciseId, sets] of setsByExercise) {
      const ex = exercises.get(exerciseId)
      if (!ex) continue
      const before = bests.get(exerciseId) ?? emptyBests()
      records += countRecords(ex.kind, before, sets)
      bests.set(exerciseId, addSession(ex.kind, before, sets))
    }
    result.set(w.id, summarize(facts, records))
  }
  return result
}

/** Пересчитывает и сохраняет итоги всех завершённых тренировок. */
export async function recomputeAllSummaries(): Promise<void> {
  await db.transaction('rw', db.workouts, db.entries, db.exercises, async () => {
    const [workouts, entries, exercises] = await Promise.all([
      db.workouts.toArray(),
      db.entries.toArray(),
      db.exercises.toArray(),
    ])
    const summaries = buildSummaries(workouts, entries, new Map(exercises.map((e) => [e.id, e])))
    const changed = workouts
      .filter((w) => summaries.has(w.id))
      .filter((w) => JSON.stringify(w.summary) !== JSON.stringify(summaries.get(w.id)))
      .map((w) => ({ ...w, summary: summaries.get(w.id) }))
    if (changed.length > 0) await db.workouts.bulkPut(changed)
  })
}
