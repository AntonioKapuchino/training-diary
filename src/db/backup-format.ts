import { isISODate } from '@/domain/dates'
import { newId } from '@/domain/ids'
import { EQUIPMENT, KINDS, MUSCLES, SET_TYPES } from '@/domain/labels'
import type {
  BodyLog,
  Equipment,
  Exercise,
  ExerciseKind,
  MuscleGroup,
  SetType,
  Template,
  TemplateSet,
  Workout,
  WorkoutEntry,
  WorkoutSet,
} from '@/domain/types'

/** Формат файла резервной копии второй версии. */
export interface BackupV2 {
  app: 'training-diary'
  format: 2
  exportedAt: string
  appVersion: string
  exercises: Exercise[]
  workouts: Workout[]
  entries: WorkoutEntry[]
  templates: Template[]
  bodyLogs: BodyLog[]
  settings?: Record<string, unknown>
}

type Obj = Record<string, unknown>

const isObj = (x: unknown): x is Obj => typeof x === 'object' && x !== null && !Array.isArray(x)
const str = (x: unknown): string | undefined => (typeof x === 'string' ? x : undefined)
const num = (x: unknown): number | undefined =>
  typeof x === 'number' && Number.isFinite(x) ? x : undefined
/** Неотрицательное число или undefined — для весов, повторов, времени. */
const amount = (x: unknown): number | undefined => {
  const n = num(x)
  return n !== undefined && n >= 0 ? n : undefined
}
/** Строка-дата, которую понимает Date.parse, — иначе undefined. */
export const validTimestamp = (x: string | undefined): string | undefined =>
  x !== undefined && Number.isFinite(Date.parse(x)) ? x : undefined
const oneOf = <T extends string>(x: unknown, values: readonly T[], fallback: T): T =>
  values.includes(x as T) ? (x as T) : fallback

export function isBackupV2(x: unknown): x is BackupV2 {
  return (
    isObj(x) &&
    x.app === 'training-diary' &&
    x.format === 2 &&
    Array.isArray(x.workouts) &&
    Array.isArray(x.entries) &&
    Array.isArray(x.exercises)
  )
}

function cleanSetValues<T extends Partial<TemplateSet>>(raw: Obj, out: T): T {
  const weight = amount(raw.weight)
  const reps = amount(raw.reps)
  const seconds = amount(raw.seconds)
  const distance = amount(raw.distance)
  if (weight !== undefined) out.weight = weight
  if (reps !== undefined) out.reps = Math.round(reps)
  if (seconds !== undefined) out.seconds = Math.round(seconds)
  if (distance !== undefined) out.distance = distance
  return out
}

export function cleanSet(raw: unknown): WorkoutSet | null {
  if (!isObj(raw)) return null
  const rawId = str(raw.id)
  const set: WorkoutSet = {
    id: rawId !== undefined && rawId !== '' ? rawId : newId(),
    type: oneOf<SetType>(raw.type, SET_TYPES, 'normal'),
    done: raw.done === true,
  }
  cleanSetValues(raw, set)
  const doneAt = num(raw.doneAt)
  if (doneAt !== undefined) set.doneAt = doneAt
  return set
}

function cleanTemplateSet(raw: unknown): TemplateSet | null {
  if (!isObj(raw)) return null
  return cleanSetValues(raw, { type: oneOf<SetType>(raw.type, SET_TYPES, 'normal') })
}

export interface CleanReport {
  dropped: number
}

/**
 * Проверка файла перед импортом: битые записи отбрасываются, ссылки сверяются.
 * Импорт не должен положить в базу то, на чём споткнётся интерфейс.
 */
export function cleanBackup(
  raw: BackupV2,
  now = Date.now(),
): { data: BackupV2; report: CleanReport } {
  let dropped = 0
  const keep = <T>(x: T | null): x is T => {
    if (x === null) dropped++
    return x !== null
  }
  // Повтор id в чужом или испорченном файле: bulkPut молча заменил бы первую запись второй.
  const unique = <T extends { id: string }>(xs: T[]): T[] => {
    const seen = new Set<string>()
    return xs.filter((x) => {
      if (seen.has(x.id)) {
        dropped++
        return false
      }
      seen.add(x.id)
      return true
    })
  }
  /** Подходы и упражнения шаблона: пустой или повторный id — новый, иначе правка задела бы оба. */
  const freshIds = <T extends { id: string }>(xs: T[]): T[] => {
    const seen = new Set<string>()
    return xs.map((x) => {
      const id = x.id && !seen.has(x.id) ? x.id : newId()
      seen.add(id)
      return id === x.id ? x : { ...x, id }
    })
  }

  const exercises = unique(
    raw.exercises
      .map((x): Exercise | null => {
        if (!isObj(x)) return null
        const id = str(x.id)
        const name = str(x.name)?.trim()
        if (!id || !name) return null
        const ex: Exercise = {
          id,
          name,
          muscle: oneOf<MuscleGroup>(x.muscle, MUSCLES, 'other'),
          kind: oneOf<ExerciseKind>(x.kind, KINDS, 'strength'),
          equipment: oneOf<Equipment>(x.equipment, EQUIPMENT, 'other'),
          custom: typeof x.custom === 'boolean' ? x.custom : !id.startsWith('c:'),
          createdAt: num(x.createdAt) ?? now,
          updatedAt: num(x.updatedAt) ?? now,
        }
        const note = str(x.note)
        if (note) ex.note = note
        const restSec = amount(x.restSec)
        if (restSec !== undefined) ex.restSec = restSec
        const archivedAt = num(x.archivedAt)
        if (archivedAt !== undefined) ex.archivedAt = archivedAt
        return ex
      })
      .filter(keep),
  )
  const exerciseIds = new Set(exercises.map((e) => e.id))

  const workouts = unique(
    raw.workouts
      .map((x): Workout | null => {
        if (!isObj(x)) return null
        const id = str(x.id)
        const date = str(x.date)
        const startedAt = num(x.startedAt)
        if (!id || !date || !isISODate(date) || startedAt === undefined) return null
        const w: Workout = {
          id,
          status: x.status === 'active' ? 'active' : 'done',
          date,
          startedAt,
          createdAt: num(x.createdAt) ?? startedAt,
          updatedAt: num(x.updatedAt) ?? now,
        }
        const finishedAt = num(x.finishedAt)
        if (finishedAt !== undefined) w.finishedAt = finishedAt
        const title = str(x.title)
        if (title) w.title = title
        const templateId = str(x.templateId)
        if (templateId) w.templateId = templateId
        const note = str(x.note)
        if (note) w.note = note
        const rating = num(x.rating)
        if (rating !== undefined && rating >= 1 && rating <= 5) w.rating = Math.round(rating)
        return w
      })
      .filter(keep),
  )

  // Активной может быть только одна тренировка — самая поздняя.
  const active = workouts
    .filter((w) => w.status === 'active')
    .sort((a, b) => b.startedAt - a.startedAt)
  for (const w of active.slice(1)) {
    w.status = 'done'
    w.finishedAt ??= w.startedAt
  }
  for (const w of workouts) if (w.status === 'done') w.finishedAt ??= w.startedAt
  const workoutById = new Map(workouts.map((w) => [w.id, w]))

  const entries = unique(
    raw.entries
      .map((x): WorkoutEntry | null => {
        if (!isObj(x)) return null
        const id = str(x.id)
        const workoutId = str(x.workoutId)
        const exerciseId = str(x.exerciseId)
        if (!id || !workoutId || !exerciseId) return null
        const workout = workoutById.get(workoutId)
        if (!workout || !exerciseIds.has(exerciseId)) return null
        const sets = freshIds(
          Array.isArray(x.sets) ? x.sets.map(cleanSet).filter((s) => s !== null) : [],
        )
        const e: WorkoutEntry = {
          id,
          workoutId,
          exerciseId,
          startedAt: workout.startedAt,
          order: num(x.order) ?? 0,
          sets,
          updatedAt: num(x.updatedAt) ?? now,
        }
        const note = str(x.note)
        if (note) e.note = note
        const restSec = amount(x.restSec)
        if (restSec !== undefined) e.restSec = restSec
        return e
      })
      .filter(keep),
  )

  const templates = unique(
    (Array.isArray(raw.templates) ? raw.templates : [])
      .map((x, i): Template | null => {
        if (!isObj(x)) return null
        const id = str(x.id)
        const name = str(x.name)?.trim()
        if (!id || !name) return null
        const items = Array.isArray(x.exercises) ? x.exercises : []
        return {
          id,
          name,
          exercises: freshIds(
            items
              .map((t) => {
                if (!isObj(t)) return null
                const exerciseId = str(t.exerciseId)
                if (!exerciseId || !exerciseIds.has(exerciseId)) return null
                const sets = Array.isArray(t.sets)
                  ? t.sets.map(cleanTemplateSet).filter((s) => s !== null)
                  : []
                const item: Template['exercises'][number] = {
                  id: str(t.id) ?? '',
                  exerciseId,
                  sets,
                }
                const restSec = amount(t.restSec)
                if (restSec !== undefined) item.restSec = restSec
                const note = str(t.note)
                if (note) item.note = note
                return item
              })
              .filter((t) => t !== null),
          ),
          order: num(x.order) ?? i,
          createdAt: num(x.createdAt) ?? now,
          updatedAt: num(x.updatedAt) ?? now,
          ...(num(x.lastUsedAt) !== undefined ? { lastUsedAt: num(x.lastUsedAt) } : {}),
          ...(str(x.note) ? { note: str(x.note) } : {}),
        }
      })
      .filter(keep),
  )

  const bodyLogs = unique(
    (Array.isArray(raw.bodyLogs) ? raw.bodyLogs : [])
      .map((x): BodyLog | null => {
        if (!isObj(x)) return null
        const id = str(x.id)
        const date = str(x.date)
        if (!id || !date || !isISODate(date)) return null
        const log: BodyLog = {
          id,
          date,
          createdAt: num(x.createdAt) ?? now,
          updatedAt: num(x.updatedAt) ?? now,
        }
        for (const k of ['weight', 'bodyFat', 'waist', 'chest', 'hips', 'arms'] as const) {
          const v = amount(x[k])
          if (v !== undefined) log[k] = v
        }
        const note = str(x.note)
        if (note) log.note = note
        return log
      })
      .filter(keep),
  )

  return {
    data: {
      app: 'training-diary',
      format: 2,
      // Неизвестная или битая дата — пусто, а не «сегодня»: показывать нечего.
      exportedAt: validTimestamp(str(raw.exportedAt)) ?? '',
      appVersion: str(raw.appVersion) ?? 'unknown',
      exercises,
      workouts,
      entries,
      templates,
      bodyLogs,
      ...(isObj(raw.settings) ? { settings: raw.settings } : {}),
    },
    report: { dropped },
  }
}
