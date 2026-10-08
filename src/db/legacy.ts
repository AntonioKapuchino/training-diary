import { combineDateTime, dateOf, isISODate } from '@/domain/dates'
import { newId } from '@/domain/ids'
import { KINDS } from '@/domain/labels'
import { normalizeText, sameName } from '@/domain/search'
import { hasAnyValue } from '@/domain/sets'
import type {
  Exercise,
  ExerciseKind,
  MuscleGroup,
  Template,
  TemplateSet,
  Workout,
  WorkoutEntry,
  WorkoutSet,
} from '@/domain/types'
import type { CatalogItem } from './catalog'
import { buildSummaries } from './summaries'

/**
 * Первая версия дневника (май 2026): Dexie-база «training-diary», числовые id,
 * группы мышц русскими строками, одна тренировка на дату. Её данные переносятся
 * в новую базу, сама она остаётся нетронутой.
 */
export const LEGACY_DB_NAME = 'training-diary'
const LEGACY_STORES = ['exercises', 'workouts', 'entries', 'templates'] as const

export interface LegacyData {
  exercises: unknown[]
  workouts: unknown[]
  entries: unknown[]
  templates: unknown[]
}

type Obj = Record<string, unknown>
const isObj = (x: unknown): x is Obj => typeof x === 'object' && x !== null && !Array.isArray(x)
const str = (x: unknown) => (typeof x === 'string' ? x : undefined)
const num = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? x : undefined)
const amount = (x: unknown) => {
  const n = num(x)
  return n !== undefined && n > 0 ? n : undefined
}

const GROUPS: Record<string, MuscleGroup> = {
  Грудь: 'chest',
  Спина: 'back',
  Ноги: 'legs',
  Плечи: 'shoulders',
  Бицепс: 'biceps',
  Трицепс: 'triceps',
  Пресс: 'core',
  Кардио: 'cardio',
  Другое: 'other',
}
const muscleOf = (x: unknown): MuscleGroup | undefined => GROUPS[str(x) ?? '']
const kindOf = (x: unknown): ExerciseKind | undefined =>
  KINDS.includes(x as ExerciseKind) ? (x as ExerciseKind) : undefined

/** Файл бэкапа первой версии. */
export function isLegacyBackup(x: unknown): x is LegacyData {
  return (
    isObj(x) &&
    x.app === 'training-diary' &&
    x.version === 1 &&
    Array.isArray(x.workouts) &&
    Array.isArray(x.entries)
  )
}

export function isEmptyLegacy(d: LegacyData): boolean {
  return (
    d.workouts.length === 0 &&
    d.templates.length === 0 &&
    d.exercises.every((x) => !isObj(x) || x.isCustom !== true)
  )
}

/**
 * Читает старую базу. Если её нет, открытие без версии создало бы пустую —
 * поэтому создание отменяется в onupgradeneeded, и ответ — null.
 * База есть, но не читается (занята, сбой, таймаут) — ошибка: отличаем от «нет».
 */
export function readLegacyDatabase(
  factory: IDBFactory = indexedDB,
  timeoutMs = 8000,
): Promise<LegacyData | null> {
  return new Promise((resolve, reject) => {
    // Зависшее открытие (базу держит другая вкладка) не должно вешать запуск.
    const timer = setTimeout(() => {
      reject(new Error('Старая база не открылась вовремя'))
    }, timeoutMs)
    const done = (value: LegacyData | null) => {
      clearTimeout(timer)
      resolve(value)
    }
    const fail = (error: unknown) => {
      clearTimeout(timer)
      reject(error instanceof Error ? error : new Error(String(error)))
    }
    let req: IDBOpenDBRequest
    try {
      req = factory.open(LEGACY_DB_NAME)
    } catch (e) {
      fail(e)
      return
    }
    // Базы нет: открытие начало бы её создавать — отменяем, это и есть ответ «нет».
    let absent = false
    req.onupgradeneeded = () => {
      absent = true
      req.transaction?.abort()
    }
    req.onerror = (e) => {
      e.preventDefault()
      if (absent) done(null)
      else fail(req.error)
    }
    req.onblocked = () => {
      fail(new Error('Старую базу держит другая вкладка'))
    }
    req.onsuccess = () => {
      const idb = req.result
      const out: LegacyData = { exercises: [], workouts: [], entries: [], templates: [] }
      const names = LEGACY_STORES.filter((n) => idb.objectStoreNames.contains(n))
      if (names.length === 0) {
        idb.close()
        done(out)
        return
      }
      try {
        const tx = idb.transaction(names, 'readonly')
        for (const n of names) {
          const r = tx.objectStore(n).getAll()
          r.onsuccess = () => {
            out[n] = r.result as unknown[]
          }
        }
        tx.oncomplete = () => {
          idb.close()
          done(out)
        }
        tx.onerror = () => {
          idb.close()
          fail(tx.error)
        }
        tx.onabort = () => {
          idb.close()
          fail(tx.error ?? new Error('Чтение старой базы прервано'))
        }
      } catch (e) {
        idb.close()
        fail(e)
      }
    }
  })
}

export interface LegacyReport {
  workouts: number
  entries: number
  sets: number
  templates: number
  /** Пустые тренировки и записи с битой датой — следы багов первой версии. */
  skippedWorkouts: number
  /** Свои упражнения, заведённые в новой базе. */
  customExercises: number
}

export interface ConvertResult {
  exercises: Exercise[]
  workouts: Workout[]
  entries: WorkoutEntry[]
  templates: Template[]
  report: LegacyReport
}

function convertSetValues(raw: unknown): Partial<TemplateSet> | null {
  if (!isObj(raw)) return null
  const v: Partial<TemplateSet> = {}
  const weight = amount(raw.weight)
  const reps = amount(raw.reps)
  const seconds = amount(raw.seconds)
  const distance = amount(raw.distance)
  if (weight !== undefined) v.weight = weight
  if (reps !== undefined) v.reps = Math.round(reps)
  if (seconds !== undefined) v.seconds = Math.round(seconds)
  if (distance !== undefined) v.distance = distance
  return hasAnyValue(v) ? v : null
}

export function convertLegacy(
  raw: LegacyData,
  catalog: readonly CatalogItem[],
  now = Date.now(),
): ConvertResult {
  // В файле первой версии могут не быть упражнений или шаблонов — это не повод падать.
  const list = (x: unknown): unknown[] => (Array.isArray(x) ? x : [])
  const data: LegacyData = {
    exercises: list(raw.exercises),
    workouts: list(raw.workouts),
    entries: list(raw.entries),
    templates: list(raw.templates),
  }
  const legacyExercises = new Map<
    number,
    { name: string; muscle: MuscleGroup; kind: ExerciseKind; custom: boolean }
  >()
  for (const x of data.exercises) {
    if (!isObj(x)) continue
    const id = num(x.id)
    const name = str(x.name)?.trim()
    if (id === undefined || !name) continue
    legacyExercises.set(id, {
      name,
      muscle: muscleOf(x.group) ?? 'other',
      kind: kindOf(x.kind) ?? 'strength',
      custom: x.isCustom === true,
    })
  }

  const created: Exercise[] = []
  const facts = new Map<string, { kind: ExerciseKind; muscle: MuscleGroup }>(
    catalog.map((c) => [c.id, { kind: c.kind, muscle: c.muscle }]),
  )
  const resolved = new Map<string, string>()

  /** Новое упражнение по имени: из каталога, если совпадает имя и способ учёта, иначе своё. */
  function resolve(name: string, muscle: MuscleGroup, kind: ExerciseKind): string {
    const key = `${normalizeText(name)}|${kind}`
    const known = resolved.get(key)
    if (known) return known
    const match = catalog.find((c) => c.kind === kind && sameName(c.name, name))
    let id: string
    if (match) {
      id = match.id
    } else {
      const ex: Exercise = {
        id: newId(),
        name,
        muscle,
        kind,
        equipment: kind === 'bodyweight' ? 'bodyweight' : 'other',
        custom: true,
        createdAt: now,
        updatedAt: now,
      }
      created.push(ex)
      facts.set(ex.id, { kind, muscle })
      id = ex.id
    }
    resolved.set(key, id)
    return id
  }

  /**
   * Упражнение записи. Запись хранила копию имени, группы и типа — по ней
   * восстанавливается история даже упражнений, которые потом удалили из каталога.
   */
  function exerciseOf(x: Obj): string | null {
    const legacy = legacyExercises.get(num(x.exerciseId) ?? Number.NaN)
    const name = str(x.exerciseName)?.trim() ?? legacy?.name
    if (!name) return null
    const kind = kindOf(x.kind) ?? legacy?.kind ?? 'strength'
    const muscle = muscleOf(x.group) ?? legacy?.muscle ?? 'other'
    return resolve(name, muscle, kind)
  }

  // Свои упражнения переносим, даже если их ещё ни разу не делали.
  for (const ex of legacyExercises.values()) if (ex.custom) resolve(ex.name, ex.muscle, ex.kind)

  const entriesByWorkout = new Map<number, Obj[]>()
  for (const x of data.entries) {
    if (!isObj(x)) continue
    const wid = num(x.workoutId)
    if (wid === undefined) continue
    const list = entriesByWorkout.get(wid)
    if (list) list.push(x)
    else entriesByWorkout.set(wid, [x])
  }

  const workouts: Workout[] = []
  const entries: WorkoutEntry[] = []
  let skippedWorkouts = 0
  let sets = 0

  for (const x of data.workouts) {
    if (!isObj(x)) {
      skippedWorkouts++
      continue
    }
    const legacyId = num(x.id)
    const date = str(x.date)
    if (legacyId === undefined || !date || !isISODate(date)) {
      skippedWorkouts++
      continue
    }
    const note = str(x.note)?.trim()
    const createdAt = num(x.createdAt)
    const startedAt =
      createdAt !== undefined && dateOf(createdAt) === date
        ? createdAt
        : combineDateTime(date, '12:00')
    const workoutId = newId()

    const legacyEntries = (entriesByWorkout.get(legacyId) ?? [])
      .map((e, i) => ({ e, i }))
      .sort((a, b) => (num(a.e.order) ?? a.i) - (num(b.e.order) ?? b.i) || a.i - b.i)
    const converted: WorkoutEntry[] = []
    for (const { e } of legacyEntries) {
      const exerciseId = exerciseOf(e)
      if (!exerciseId) continue
      const entrySets: WorkoutSet[] = (Array.isArray(e.sets) ? e.sets : [])
        .map(convertSetValues)
        .filter((v) => v !== null)
        .map((v) => ({ id: newId(), type: 'normal', ...v, done: true }))
      if (entrySets.length === 0) continue
      sets += entrySets.length
      const entry: WorkoutEntry = {
        id: newId(),
        workoutId,
        exerciseId,
        startedAt,
        order: converted.length,
        sets: entrySets,
        updatedAt: now,
      }
      const comment = str(e.comment)?.trim()
      if (comment) entry.note = comment
      converted.push(entry)
    }

    // Пустые дни появлялись, когда тренировку просто открывали и закрывали.
    if (converted.length === 0 && !note) {
      skippedWorkouts++
      continue
    }
    const w: Workout = {
      id: workoutId,
      status: 'done',
      date,
      startedAt,
      // Длительность первая версия не знала: конец = начало, интерфейс её не покажет.
      finishedAt: startedAt,
      createdAt: createdAt ?? startedAt,
      updatedAt: now,
    }
    if (note) w.note = note
    workouts.push(w)
    entries.push(...converted)
  }

  const templates: Template[] = []
  const legacyTemplates = data.templates
    .filter(isObj)
    .map((t, i) => ({ t, i }))
    .sort((a, b) => (num(a.t.createdAt) ?? 0) - (num(b.t.createdAt) ?? 0) || a.i - b.i)
  for (const { t } of legacyTemplates) {
    const name = str(t.name)?.trim()
    if (!name) continue
    const items = (Array.isArray(t.exercises) ? t.exercises : [])
      .filter(isObj)
      .map((e) => {
        const exerciseId = exerciseOf(e)
        if (!exerciseId) return null
        const setsOf: TemplateSet[] = (Array.isArray(e.sets) ? e.sets : [])
          .map(convertSetValues)
          .filter((v) => v !== null)
          .map((v) => ({ type: 'normal', ...v }))
        return {
          id: newId(),
          exerciseId,
          sets: setsOf.length > 0 ? setsOf : [{ type: 'normal' as const }],
        }
      })
      .filter((e) => e !== null)
    if (items.length === 0) continue
    const createdAt = num(t.createdAt) ?? now
    templates.push({
      id: newId(),
      name,
      exercises: items,
      order: templates.length,
      createdAt,
      updatedAt: now,
    })
  }

  const summaries = buildSummaries(workouts, entries, facts)
  for (const w of workouts) {
    const s = summaries.get(w.id)
    if (s) w.summary = s
  }

  return {
    exercises: created,
    workouts,
    entries,
    templates,
    report: {
      workouts: workouts.length,
      entries: entries.length,
      sets,
      templates: templates.length,
      skippedWorkouts,
      customExercises: created.length,
    },
  }
}
