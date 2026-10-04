import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/db'
import { historyBests, lastSession } from '@/db/workouts'
import type { Bests } from '@/domain/records'
import type { Exercise, TemplateSet, Workout, WorkoutEntry, WorkoutSet } from '@/domain/types'

export interface WorkoutContext {
  /** Подходы прошлой тренировки с каждым упражнением. */
  previous: Map<string, WorkoutSet[]>
  /** Подходы из программы — подсказки, если упражнение делается впервые. */
  template: Map<string, TemplateSet[]>
  /** Лучшие значения до этой тренировки — для отметок рекордов. */
  bests: Map<string, Bests>
}

/**
 * Всё, что нужно редактору тренировки сверх её собственных записей, одним живым запросом.
 * Перезапускается сам, когда меняются данные, от которых зависит.
 */
export function useWorkoutContext(
  workout: Workout,
  entries: readonly WorkoutEntry[] | undefined,
  exercises: ReadonlyMap<string, Exercise> | undefined,
): WorkoutContext | undefined {
  const ids = [...new Set((entries ?? []).map((e) => e.exerciseId))]
  const key = ids.join(',')
  return useLiveQuery(async () => {
    const previous = new Map<string, WorkoutSet[]>()
    const bests = new Map<string, Bests>()
    for (const id of ids) {
      const ex = exercises?.get(id)
      const last = await lastSession(id, workout.startedAt, workout.id)
      if (last) previous.set(id, last.sets)
      if (ex) bests.set(id, await historyBests(id, ex.kind, workout.startedAt, workout.id))
    }
    const template = new Map<string, TemplateSet[]>()
    if (workout.templateId) {
      const t = await db.templates.get(workout.templateId)
      for (const item of t?.exercises ?? []) template.set(item.exerciseId, item.sets)
    }
    return { previous, template, bests }
  }, [key, workout.id, workout.startedAt, workout.templateId, exercises])
}
