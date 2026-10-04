import { Dexie } from 'dexie'
import { combineDateTime, dateOf, todayISO } from '@/domain/dates'
import { newId } from '@/domain/ids'
import { addSession, emptyBests, recordSets, type Bests, type RecordType } from '@/domain/records'
import {
  defaultSetCount,
  hasAnyValue,
  isComplete,
  isWorking,
  makeSet,
  pickValues,
} from '@/domain/sets'
import type {
  ExerciseKind,
  SetType,
  TemplateSet,
  Workout,
  WorkoutEntry,
  WorkoutSet,
} from '@/domain/types'
import { db } from './db'
import { recomputeAllSummaries } from './summaries'

export async function getActiveWorkout(): Promise<Workout | undefined> {
  return db.workouts.where('status').equals('active').first()
}

export interface PastSession {
  workoutId: string
  startedAt: number
  sets: WorkoutSet[]
}

/**
 * Прошлая завершённая тренировка с упражнением — до момента `before`.
 * Её подходы — подсказки в колонке «Прошлый раз» и в пустых ячейках.
 */
export async function lastSession(
  exerciseId: string,
  before = Number.POSITIVE_INFINITY,
  excludeWorkoutId?: string,
): Promise<PastSession | null> {
  const entries = await db.entries
    .where('[exerciseId+startedAt]')
    .between([exerciseId, Dexie.minKey], [exerciseId, before], true, false)
    .reverse()
    .toArray()
  const checked = new Set<string>()
  for (const e of entries) {
    if (e.workoutId === excludeWorkoutId || checked.has(e.workoutId)) continue
    checked.add(e.workoutId)
    const w = await db.workouts.get(e.workoutId)
    if (w?.status !== 'done') continue
    const sets = entries
      .filter((x) => x.workoutId === e.workoutId)
      .sort((a, b) => a.order - b.order)
      .flatMap((x) => x.sets)
      .filter((s) => s.done || hasAnyValue(s))
    return { workoutId: w.id, startedAt: w.startedAt, sets }
  }
  return null
}

/**
 * Лучшие значения по упражнению до момента `before` — основа для отметок рекордов.
 */
export async function historyBests(
  exerciseId: string,
  kind: ExerciseKind,
  before = Number.POSITIVE_INFINITY,
  excludeWorkoutId?: string,
): Promise<Bests> {
  const entries = await db.entries
    .where('[exerciseId+startedAt]')
    .between([exerciseId, Dexie.minKey], [exerciseId, before], true, false)
    .toArray()
  const ids = [...new Set(entries.map((e) => e.workoutId))].filter((id) => id !== excludeWorkoutId)
  const workouts = await db.workouts.bulkGet(ids)
  const done = new Set(workouts.filter((w) => w?.status === 'done').map((w) => w?.id))
  let bests = emptyBests()
  for (const id of ids) {
    if (!done.has(id)) continue
    bests = addSession(
      kind,
      bests,
      entries.filter((e) => e.workoutId === id).flatMap((e) => e.sets),
    )
  }
  return bests
}

/** Подходы для нового упражнения в тренировке: структура — из шаблона или прошлого раза. */
function plannedSets(
  kind: ExerciseKind,
  template?: readonly TemplateSet[],
  last?: PastSession | null,
) {
  if (template && template.length > 0) return template.map((t) => makeSet({ type: t.type }))
  if (last && last.sets.length > 0) return last.sets.map((s) => makeSet({ type: s.type }))
  return Array.from({ length: defaultSetCount(kind) }, () => makeSet())
}

interface StartOptions {
  templateId?: string
  /** Повторить состав прошлой тренировки. */
  repeatOf?: string
  title?: string
}

/**
 * Начинает тренировку. Активная может быть только одна — если она уже идёт,
 * возвращается она.
 */
export async function startWorkout(opts: StartOptions = {}): Promise<string> {
  return db.transaction('rw', [db.workouts, db.entries, db.templates, db.exercises], async () => {
    const active = await getActiveWorkout()
    if (active) return active.id

    const now = Date.now()
    const template = opts.templateId ? await db.templates.get(opts.templateId) : undefined
    const source = opts.repeatOf ? await db.workouts.get(opts.repeatOf) : undefined
    const workout: Workout = {
      id: newId(),
      status: 'active',
      date: todayISO(),
      startedAt: now,
      createdAt: now,
      updatedAt: now,
    }
    const title = opts.title ?? template?.name ?? source?.title
    if (title) workout.title = title
    if (template) workout.templateId = template.id
    else if (source?.templateId) workout.templateId = source.templateId

    const plan: { exerciseId: string; sets?: TemplateSet[]; restSec?: number }[] = template
      ? template.exercises.map((t) => ({
          exerciseId: t.exerciseId,
          sets: t.sets,
          ...(t.restSec !== undefined ? { restSec: t.restSec } : {}),
        }))
      : source
        ? (await db.entries.where('workoutId').equals(source.id).sortBy('order')).map((e) => ({
            exerciseId: e.exerciseId,
            sets: e.sets.map((s) => ({ type: s.type })),
          }))
        : []

    const entries: WorkoutEntry[] = []
    for (const item of plan) {
      const ex = await db.exercises.get(item.exerciseId)
      if (!ex) continue
      const last = await lastSession(ex.id, now)
      const entry: WorkoutEntry = {
        id: newId(),
        workoutId: workout.id,
        exerciseId: ex.id,
        startedAt: now,
        order: entries.length,
        sets: plannedSets(ex.kind, item.sets, last),
        updatedAt: now,
      }
      if (item.restSec !== undefined) entry.restSec = item.restSec
      entries.push(entry)
    }

    await db.workouts.add(workout)
    if (entries.length > 0) await db.entries.bulkAdd(entries)
    if (template) await db.templates.update(template.id, { lastUsedAt: now })
    return workout.id
  })
}

/** Прошлая тренировка, внесённая задним числом: сразу завершённая. */
export async function createPastWorkout(date: string, time = '18:00'): Promise<string> {
  const startedAt = combineDateTime(date, time)
  const now = Date.now()
  const workout: Workout = {
    id: newId(),
    status: 'done',
    date,
    startedAt,
    finishedAt: startedAt + 60 * 60_000,
    createdAt: now,
    updatedAt: now,
    summary: { exercises: 0, sets: 0, volume: 0, reps: 0, muscles: [], records: 0 },
  }
  await db.workouts.add(workout)
  return workout.id
}

export async function addExercises(
  workoutId: string,
  exerciseIds: readonly string[],
): Promise<string[]> {
  const workout = await db.workouts.get(workoutId)
  if (!workout) return []
  const existing = await db.entries.where('workoutId').equals(workoutId).toArray()
  let order = existing.reduce((m, e) => Math.max(m, e.order), -1) + 1
  const now = Date.now()
  const added: WorkoutEntry[] = []
  for (const exerciseId of exerciseIds) {
    const ex = await db.exercises.get(exerciseId)
    if (!ex) continue
    const last = await lastSession(ex.id, workout.startedAt, workoutId)
    added.push({
      id: newId(),
      workoutId,
      exerciseId,
      startedAt: workout.startedAt,
      order: order++,
      sets: plannedSets(ex.kind, undefined, last),
      updatedAt: now,
    })
  }
  await db.entries.bulkAdd(added)
  await touch(workoutId)
  return added.map((e) => e.id)
}

async function touch(workoutId: string): Promise<void> {
  const w = await db.workouts.get(workoutId)
  if (!w) return
  await db.workouts.update(workoutId, { updatedAt: Date.now() })
  if (w.status === 'done') scheduleRecompute()
}

let recomputeTimer: ReturnType<typeof setTimeout> | undefined
/** Правки завершённых тренировок меняют рекорды следующих — пересчёт с задержкой, пачкой. */
function scheduleRecompute(): void {
  if (recomputeTimer) clearTimeout(recomputeTimer)
  recomputeTimer = setTimeout(() => {
    recomputeTimer = undefined
    void recomputeAllSummaries()
  }, 400)
}

/** Для тестов и перед экспортом: дождаться отложенного пересчёта. */
export async function flushRecompute(): Promise<void> {
  if (!recomputeTimer) return
  clearTimeout(recomputeTimer)
  recomputeTimer = undefined
  await recomputeAllSummaries()
}

/**
 * Чтение и запись — в одной транзакции: IndexedDB выполняет их по очереди.
 * Без этого две быстрые правки одного упражнения читали бы одну и ту же версию,
 * и вторая затирала бы первую (так терялся набранный вес).
 */
async function mutateEntry(
  entryId: string,
  fn: (e: WorkoutEntry) => void,
): Promise<WorkoutEntry | undefined> {
  const entry = await db.transaction('rw', db.entries, async () => {
    const e = await db.entries.get(entryId)
    if (!e) return undefined
    fn(e)
    e.updatedAt = Date.now()
    await db.entries.put(e)
    return e
  })
  if (entry) await touch(entry.workoutId)
  return entry
}

export type SetPatch = Partial<
  Pick<WorkoutSet, 'weight' | 'reps' | 'seconds' | 'distance' | 'type' | 'done'>
>

export async function updateSet(entryId: string, setId: string, patch: SetPatch): Promise<void> {
  await mutateEntry(entryId, (e) => {
    e.sets = e.sets.map((s) => {
      if (s.id !== setId) return s
      const next: WorkoutSet = compact({ ...s, ...patch })
      if (patch.done === true && !s.done) next.doneAt = Date.now()
      if (patch.done === false) delete next.doneAt
      return next
    })
  })
}

export type ToggleResult = 'done' | 'undone' | 'incomplete'

/**
 * Отметить подход. Если ячейки пустые, берутся подсказки (прошлый раз или шаблон) —
 * как в Strong: повторил прошлый подход одним касанием.
 */
export async function toggleSetDone(
  entryId: string,
  setId: string,
  kind: ExerciseKind,
  hint?: Partial<TemplateSet>,
): Promise<ToggleResult> {
  let result: ToggleResult = 'incomplete'
  await mutateEntry(entryId, (e) => {
    e.sets = e.sets.map((s) => {
      if (s.id !== setId) return s
      if (s.done) {
        result = 'undone'
        const next = { ...s, done: false }
        delete next.doneAt
        return next
      }
      const filled: WorkoutSet = { ...(hint ? pickValues(hint) : {}), ...dropEmpty(s) }
      if (!isComplete(kind, filled)) return s
      result = 'done'
      return { ...filled, done: true, doneAt: Date.now() }
    })
  })
  return result
}

/** Пустые значения не перекрывают подсказку. */
function dropEmpty(s: WorkoutSet): WorkoutSet {
  const positive = (n: number | undefined) => (n !== undefined && n > 0 ? n : undefined)
  return compact({
    ...s,
    weight: positive(s.weight),
    reps: positive(s.reps),
    seconds: positive(s.seconds),
    distance: positive(s.distance),
  })
}

/** Убирает поля со значением undefined: в базе их нет, а не «есть, но пустые». */
function compact<T extends object>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T
}

/** Новый подход — копия последнего: обычно следующий такой же. */
export async function addSet(entryId: string): Promise<string | undefined> {
  let id: string | undefined
  const workoutDone = await isDoneWorkoutEntry(entryId)
  await mutateEntry(entryId, (e) => {
    const last = e.sets.at(-1)
    const type: SetType = last && isWorking(last) ? last.type : 'normal'
    const set = makeSet({ type, ...(last ? pickValues(last) : {}) })
    if (workoutDone) {
      set.done = hasAnyValue(set)
      if (set.done) set.doneAt = Date.now()
    }
    id = set.id
    e.sets = [...e.sets, set]
  })
  return id
}

async function isDoneWorkoutEntry(entryId: string): Promise<boolean> {
  const e = await db.entries.get(entryId)
  if (!e) return false
  return (await db.workouts.get(e.workoutId))?.status === 'done'
}

export interface RemovedSet {
  entryId: string
  index: number
  set: WorkoutSet
}

export async function removeSet(entryId: string, setId: string): Promise<RemovedSet | undefined> {
  let removed: RemovedSet | undefined
  await mutateEntry(entryId, (e) => {
    const index = e.sets.findIndex((s) => s.id === setId)
    const set = e.sets[index]
    if (index < 0 || !set) return
    removed = { entryId, index, set }
    e.sets = e.sets.filter((s) => s.id !== setId)
  })
  return removed
}

export async function restoreSet(r: RemovedSet): Promise<void> {
  await mutateEntry(r.entryId, (e) => {
    const sets = [...e.sets]
    sets.splice(Math.min(r.index, sets.length), 0, r.set)
    e.sets = sets
  })
}

export async function updateEntry(
  entryId: string,
  patch: { note?: string; restSec?: number | null },
): Promise<void> {
  await mutateEntry(entryId, (e) => {
    if (patch.note !== undefined) {
      const note = patch.note.trim()
      if (note) e.note = note
      else delete e.note
    }
    if (patch.restSec === null) delete e.restSec
    else if (patch.restSec !== undefined) e.restSec = patch.restSec
  })
}

export async function reorderEntries(
  workoutId: string,
  orderedIds: readonly string[],
): Promise<void> {
  await db.transaction('rw', db.entries, async () => {
    const entries = await db.entries.where('workoutId').equals(workoutId).toArray()
    const pos = new Map(orderedIds.map((id, i) => [id, i]))
    const changed = entries
      .map((e) => ({ e, order: pos.get(e.id) ?? e.order }))
      .filter(({ e, order }) => e.order !== order)
      .map(({ e, order }) => ({ ...e, order }))
    if (changed.length > 0) await db.entries.bulkPut(changed)
  })
  await touch(workoutId)
}

export async function removeEntry(entryId: string): Promise<WorkoutEntry | undefined> {
  const entry = await db.entries.get(entryId)
  if (!entry) return undefined
  await db.entries.delete(entryId)
  await touch(entry.workoutId)
  return entry
}

export async function restoreEntry(entry: WorkoutEntry): Promise<void> {
  await db.entries.put(entry)
  await touch(entry.workoutId)
}

/** Заменить упражнение: при том же типе учёта подходы остаются, иначе — пустые. */
export async function replaceExercise(entryId: string, exerciseId: string): Promise<void> {
  const entry = await db.entries.get(entryId)
  const [from, to] = await db.exercises.bulkGet([entry?.exerciseId ?? '', exerciseId])
  if (!entry || !to) return
  await mutateEntry(entryId, (e) => {
    e.exerciseId = exerciseId
    if (from?.kind !== to.kind) e.sets = e.sets.map((s) => makeSet({ type: s.type }))
  })
}

export interface WorkoutPatch {
  title?: string
  note?: string
  rating?: number | null
  date?: string
  startedAt?: number
  finishedAt?: number
}

export async function updateWorkout(workoutId: string, patch: WorkoutPatch): Promise<void> {
  await db.transaction('rw', db.workouts, db.entries, async () => {
    const w = await db.workouts.get(workoutId)
    if (!w) return
    const next: Workout = { ...w, updatedAt: Date.now() }
    if (patch.title !== undefined) {
      const t = patch.title.trim()
      if (t) next.title = t
      else delete next.title
    }
    if (patch.note !== undefined) {
      const n = patch.note.trim()
      if (n) next.note = n
      else delete next.note
    }
    if (patch.rating === null) delete next.rating
    else if (patch.rating !== undefined) next.rating = patch.rating
    if (patch.startedAt !== undefined) {
      next.startedAt = patch.startedAt
      next.date = dateOf(patch.startedAt)
      // Сдвиг начала сохраняет длительность, если конец не задан явно.
      if (patch.finishedAt === undefined && w.finishedAt !== undefined) {
        next.finishedAt = patch.startedAt + (w.finishedAt - w.startedAt)
      }
    }
    if (patch.finishedAt !== undefined) next.finishedAt = patch.finishedAt
    if (patch.date !== undefined && patch.startedAt === undefined) {
      // Перенос на другой день с тем же временем начала и длительностью.
      const time = new Date(w.startedAt)
      const moved = combineDateTime(patch.date, `${time.getHours()}:${time.getMinutes()}`)
      next.date = patch.date
      next.startedAt = moved
      if (w.finishedAt !== undefined) next.finishedAt = moved + (w.finishedAt - w.startedAt)
    }
    await db.workouts.put(next)
    if (next.startedAt !== w.startedAt) {
      await db.entries.where('workoutId').equals(workoutId).modify({ startedAt: next.startedAt })
    }
  })
  const w = await db.workouts.get(workoutId)
  if (w?.status === 'done') scheduleRecompute()
}

export interface FinishStats {
  unfinished: number
  /** Невыполненные, но заполненные подходы — их можно засчитать. */
  filled: number
  doneSets: number
}

export async function finishStats(
  workoutId: string,
  kinds: ReadonlyMap<string, ExerciseKind>,
): Promise<FinishStats> {
  const entries = await db.entries.where('workoutId').equals(workoutId).toArray()
  let unfinished = 0
  let filled = 0
  let doneSets = 0
  for (const e of entries) {
    const kind = kinds.get(e.exerciseId) ?? 'strength'
    for (const s of e.sets) {
      if (s.done) doneSets++
      else {
        unfinished++
        if (isComplete(kind, s)) filled++
      }
    }
  }
  return { unfinished, filled, doneSets }
}

/**
 * Завершает тренировку. Заполненные, но не отмеченные подходы засчитываются
 * (`countFilled`) или выбрасываются; пустые выбрасываются всегда.
 */
export async function finishWorkout(
  workoutId: string,
  opts: { countFilled: boolean },
): Promise<void> {
  await db.transaction('rw', [db.workouts, db.entries, db.exercises], async () => {
    const w = await db.workouts.get(workoutId)
    if (w?.status !== 'active') return
    const now = Date.now()
    const entries = await db.entries.where('workoutId').equals(workoutId).toArray()
    const exercises = await db.exercises.bulkGet(entries.map((e) => e.exerciseId))
    const kinds = new Map(exercises.filter((x) => x !== undefined).map((x) => [x.id, x.kind]))
    const keep: WorkoutEntry[] = []
    const drop: string[] = []
    for (const e of entries) {
      const kind = kinds.get(e.exerciseId) ?? 'strength'
      const sets = e.sets
        .map((s) =>
          !s.done && opts.countFilled && isComplete(kind, s)
            ? { ...s, done: true, doneAt: now }
            : s,
        )
        .filter((s) => s.done)
      if (sets.length === 0) drop.push(e.id)
      else keep.push({ ...e, sets, updatedAt: now })
    }
    // Порядок без дыр после выброшенных упражнений.
    keep.sort((a, b) => a.order - b.order).forEach((e, i) => (e.order = i))
    await db.entries.bulkDelete(drop)
    await db.entries.bulkPut(keep)
    await db.workouts.put({ ...w, status: 'done', finishedAt: now, updatedAt: now })
  })
  await recomputeAllSummaries()
}

/** Отменить идущую тренировку целиком. */
export async function discardWorkout(workoutId: string): Promise<void> {
  await db.transaction('rw', db.workouts, db.entries, async () => {
    await db.entries.where('workoutId').equals(workoutId).delete()
    await db.workouts.delete(workoutId)
  })
}

export interface DeletedWorkout {
  workout: Workout
  entries: WorkoutEntry[]
}

export async function deleteWorkout(workoutId: string): Promise<DeletedWorkout | undefined> {
  const deleted = await db.transaction('rw', db.workouts, db.entries, async () => {
    const workout = await db.workouts.get(workoutId)
    if (!workout) return undefined
    const entries = await db.entries.where('workoutId').equals(workoutId).toArray()
    await db.entries.bulkDelete(entries.map((e) => e.id))
    await db.workouts.delete(workoutId)
    return { workout, entries }
  })
  if (deleted) scheduleRecompute()
  return deleted
}

export async function restoreWorkout(d: DeletedWorkout): Promise<void> {
  await db.transaction('rw', db.workouts, db.entries, async () => {
    await db.workouts.put(d.workout)
    await db.entries.bulkPut(d.entries)
  })
  scheduleRecompute()
}

export interface WorkoutRecord {
  exerciseId: string
  setId: string
  types: RecordType[]
}

/** Рекорды тренировки по подходам — для итогов и отметок в истории. */
export async function workoutRecords(workoutId: string): Promise<WorkoutRecord[]> {
  const w = await db.workouts.get(workoutId)
  if (!w) return []
  const entries = (await db.entries.where('workoutId').equals(workoutId).toArray()).sort(
    (a, b) => a.order - b.order,
  )
  const out: WorkoutRecord[] = []
  const seen = new Set<string>()
  for (const e of entries) {
    if (seen.has(e.exerciseId)) continue
    seen.add(e.exerciseId)
    const ex = await db.exercises.get(e.exerciseId)
    if (!ex) continue
    const before = await historyBests(ex.id, ex.kind, w.startedAt, w.id)
    const sets = entries.filter((x) => x.exerciseId === ex.id).flatMap((x) => x.sets)
    for (const [setId, types] of recordSets(ex.kind, before, sets)) {
      out.push({ exerciseId: ex.id, setId, types })
    }
  }
  return out
}
