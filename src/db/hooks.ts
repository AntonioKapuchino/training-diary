import { Dexie } from 'dexie'
import { useLiveQuery } from 'dexie-react-hooks'
import type { BodyLog, Exercise, Template, Workout, WorkoutEntry, WorkoutSet } from '@/domain/types'
import { db, getMeta } from './db'
import type { MigrationState } from './migrate'
import { lastSession, type PastSession } from './workouts'

/*
 * Живые запросы: компонент перерисуется сам, когда данные в базе изменятся.
 * undefined — ещё грузится, null — записи нет.
 */

const byName = (a: Exercise, b: Exercise) => a.name.localeCompare(b.name, 'ru')

export function useExercises(): Exercise[] | undefined {
  return useLiveQuery(async () => (await db.exercises.toArray()).sort(byName), [])
}

export function useExerciseMap(): Map<string, Exercise> | undefined {
  return useLiveQuery(async () => new Map((await db.exercises.toArray()).map((e) => [e.id, e])), [])
}

export function useExercise(id: string | undefined): Exercise | null | undefined {
  return useLiveQuery(async () => (id ? ((await db.exercises.get(id)) ?? null) : null), [id])
}

export function useActiveWorkout(): Workout | null | undefined {
  return useLiveQuery(
    async () => (await db.workouts.where('status').equals('active').first()) ?? null,
    [],
  )
}

export function useWorkout(id: string | undefined): Workout | null | undefined {
  return useLiveQuery(async () => (id ? ((await db.workouts.get(id)) ?? null) : null), [id])
}

export function useEntries(workoutId: string | undefined): WorkoutEntry[] | undefined {
  return useLiveQuery(
    async () => (workoutId ? db.entries.where('workoutId').equals(workoutId).sortBy('order') : []),
    [workoutId],
  )
}

/** Завершённые тренировки, новые сверху. */
export function useDoneWorkouts(): Workout[] | undefined {
  return useLiveQuery(
    () =>
      db.workouts
        .where('[status+startedAt]')
        .between(['done', Dexie.minKey], ['done', Dexie.maxKey])
        .reverse()
        .toArray(),
    [],
  )
}

export function useTemplates(): Template[] | undefined {
  return useLiveQuery(() => db.templates.orderBy('order').toArray(), [])
}

export function useTemplate(id: string | undefined): Template | null | undefined {
  return useLiveQuery(async () => (id ? ((await db.templates.get(id)) ?? null) : null), [id])
}

export function useBodyLogs(): BodyLog[] | undefined {
  return useLiveQuery(() => db.bodyLogs.orderBy('date').toArray(), [])
}

export function useLastSession(
  exerciseId: string | undefined,
  before: number | undefined,
  excludeWorkoutId?: string,
): PastSession | null | undefined {
  return useLiveQuery(
    () => (exerciseId ? lastSession(exerciseId, before, excludeWorkoutId) : null),
    [exerciseId, before, excludeWorkoutId],
  )
}

export interface ExerciseSession {
  workout: Workout
  sets: WorkoutSet[]
  note?: string
}

/** История упражнения по тренировкам, новые сверху. */
export function useExerciseHistory(exerciseId: string | undefined): ExerciseSession[] | undefined {
  return useLiveQuery(async () => {
    if (!exerciseId) return []
    const entries = await db.entries
      .where('[exerciseId+startedAt]')
      .between([exerciseId, Dexie.minKey], [exerciseId, Dexie.maxKey])
      .toArray()
    const ids = [...new Set(entries.map((e) => e.workoutId))]
    const workouts = (await db.workouts.bulkGet(ids)).filter(
      (w): w is Workout => w?.status === 'done',
    )
    return workouts
      .map((workout) => {
        const own = entries
          .filter((e) => e.workoutId === workout.id)
          .sort((a, b) => a.order - b.order)
        const session: ExerciseSession = {
          workout,
          sets: own.flatMap((e) => e.sets).filter((s) => s.done),
        }
        const note = own
          .map((e) => e.note)
          .filter(Boolean)
          .join(' · ')
        if (note) session.note = note
        return session
      })
      .filter((s) => s.sets.length > 0)
      .sort((a, b) => b.workout.startedAt - a.workout.startedAt)
  }, [exerciseId])
}

/** Упражнения из последних тренировок — первыми в выборе. */
export function useRecentExerciseIds(limit = 8): string[] | undefined {
  return useLiveQuery(async () => {
    const recent = await db.workouts
      .where('[status+startedAt]')
      .between(['done', Dexie.minKey], ['done', Dexie.maxKey])
      .reverse()
      .limit(12)
      .toArray()
    const out: string[] = []
    for (const w of recent) {
      const entries = await db.entries.where('workoutId').equals(w.id).sortBy('order')
      for (const e of entries) {
        if (!out.includes(e.exerciseId)) out.push(e.exerciseId)
        if (out.length >= limit) return out
      }
    }
    return out
  }, [limit])
}

export function useMigrationState(): MigrationState | null | undefined {
  return useLiveQuery(async () => (await getMeta<MigrationState>('legacyMigration')) ?? null, [])
}

export function useLastExportAt(): number | null | undefined {
  return useLiveQuery(async () => (await getMeta<number>('lastExportAt')) ?? null, [])
}

/** Все записи упражнений — для сводной статистики. */
export function useAllEntries(): WorkoutEntry[] | undefined {
  return useLiveQuery(() => db.entries.toArray(), [])
}
