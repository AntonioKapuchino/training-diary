import { Dexie } from 'dexie'
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
  // Одинаковое начало (прошлые тренировки по умолчанию в 18:00) — порядок по id,
  // как в historyBests: рекорд одной из них не должен зависеть от случая.
  const ordered = [...workouts]
    .filter((w) => w.status === 'done')
    .sort((a, b) => a.startedAt - b.startedAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))

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

/**
 * Отметка «итоги могут быть устаревшими»: правку записали, а пересчёт ещё не прошёл.
 * Если приложение закроют в эту секунду, при следующем запуске пересчёт доделается.
 */
export const SUMMARIES_DIRTY = 'summariesDirty'

/** Ставит отметку. Вне текущей транзакции — её таблицы могут не включать meta. */
export function markSummariesDirty(): Promise<void> {
  return Dexie.ignoreTransaction(async () => {
    await db.meta.put({ key: SUMMARIES_DIRTY, value: true })
  })
}

/**
 * Версия правил подсчёта итогов. Правила поменялись (как считаются рекорды и т. п.) —
 * повышаем, и при первом запуске новой версии итоги старых тренировок пересчитаются.
 */
export const SUMMARIES_VERSION = 2
export const SUMMARIES_VERSION_KEY = 'summariesVersion'

/**
 * При запуске: досчитать то, что не успело пересчитаться в прошлый раз,
 * и пересчитать всё один раз, если итоги посчитаны по старым правилам.
 */
export async function repairSummaries(): Promise<void> {
  const [dirty, version] = await Promise.all([
    db.meta.get(SUMMARIES_DIRTY),
    db.meta.get(SUMMARIES_VERSION_KEY),
  ])
  if (dirty?.value || version?.value !== SUMMARIES_VERSION) await recomputeAllSummaries()
}

/** Пересчитывает и сохраняет итоги всех завершённых тренировок. */
export async function recomputeAllSummaries(): Promise<void> {
  await db.transaction('rw', [db.workouts, db.entries, db.exercises, db.meta], async () => {
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
    await db.meta.delete(SUMMARIES_DIRTY)
    await db.meta.put({ key: SUMMARIES_VERSION_KEY, value: SUMMARIES_VERSION })
  })
}
