import { beforeEach, describe, expect, it } from 'vitest'
import { combineDateTime } from '@/domain/dates'
import { CATALOG } from './catalog'
import { db } from './db'
import {
  convertLegacy,
  isLegacyBackup,
  LEGACY_DB_NAME,
  readLegacyDatabase,
  type LegacyData,
} from './legacy'
import { migrateLegacy } from './migrate'
import { ensureCatalog } from './seed'

/** Первые три упражнения встроенного каталога первой версии + одно своё. */
const legacyExercises = [
  { id: 1, name: 'Жим лёжа', group: 'Грудь', kind: 'strength', isCustom: false },
  { id: 6, name: 'Подтягивания', group: 'Спина', kind: 'bodyweight', isCustom: false },
  { id: 30, name: 'Планка', group: 'Пресс', kind: 'timed', isCustom: false },
  // Набрано через «е» — в первой версии поиск его не находил, и человек завёл дубль.
  { id: 35, name: 'Подъем на носки', group: 'Ноги', kind: 'strength', isCustom: true },
  { id: 36, name: 'Тяга к поясу', group: 'Спина', kind: 'strength', isCustom: true },
]

const at = (date: string, time: string) => combineDateTime(date, time)

function sample(): LegacyData {
  return {
    exercises: legacyExercises,
    workouts: [
      { id: 1, date: '2026-05-04', createdAt: at('2026-05-04', '19:05'), note: 'Первая' },
      { id: 2, date: '2026-05-06', createdAt: at('2026-05-20', '10:00') }, // внесена задним числом
      { id: 3, date: '2026-05-08', createdAt: at('2026-05-08', '18:00') }, // пустая: открыли и закрыли
      { id: 4, date: '', createdAt: at('2026-05-09', '18:00') }, // баг со сброшенной датой
      { id: 5, date: '2026-05-10', createdAt: at('2026-05-10', '18:00'), note: 'Только заметка' },
      { id: 6, date: '2026-05-06', createdAt: at('2026-05-06', '20:00') }, // дубль даты
    ],
    entries: [
      {
        id: 1,
        workoutId: 1,
        exerciseId: 1,
        exerciseName: 'Жим лёжа',
        group: 'Грудь',
        kind: 'strength',
        order: 1,
        sets: [
          { reps: 8, weight: 60 },
          { reps: 8, weight: 60 },
        ],
        comment: 'Без страховки',
      },
      {
        id: 2,
        workoutId: 1,
        exerciseId: 30,
        exerciseName: 'Планка',
        group: 'Пресс',
        kind: 'timed',
        order: 0,
        sets: [{ seconds: 60 }, { seconds: 0 }],
      },
      {
        id: 3,
        workoutId: 2,
        exerciseId: 1,
        exerciseName: 'Жим лёжа',
        group: 'Грудь',
        kind: 'strength',
        order: 0,
        sets: [{ reps: 8, weight: 62.5 }],
      },
      // Своё упражнение, которое потом удалили из каталога: остались только записи.
      {
        id: 4,
        workoutId: 2,
        exerciseId: 99,
        exerciseName: 'Тяга гантели к поясу',
        group: 'Спина',
        kind: 'strength',
        order: 1,
        sets: [{ reps: 10, weight: 22 }],
      },
      {
        id: 5,
        workoutId: 2,
        exerciseId: 35,
        exerciseName: 'Подъем на носки',
        group: 'Ноги',
        kind: 'strength',
        order: 2,
        sets: [{ reps: 15, weight: 80 }],
      },
      {
        id: 6,
        workoutId: 6,
        exerciseId: 6,
        exerciseName: 'Подтягивания',
        group: 'Спина',
        kind: 'bodyweight',
        order: 0,
        sets: [{ reps: 10, weight: 0 }],
      },
      // Подходы без значений — запись не переносится.
      {
        id: 7,
        workoutId: 6,
        exerciseId: 1,
        exerciseName: 'Жим лёжа',
        group: 'Грудь',
        kind: 'strength',
        order: 1,
        sets: [{ reps: 0, weight: 0 }],
      },
    ],
    templates: [
      {
        id: 1,
        name: 'День A',
        createdAt: at('2026-05-04', '20:00'),
        exercises: [
          {
            exerciseId: 1,
            exerciseName: 'Жим лёжа',
            group: 'Грудь',
            kind: 'strength',
            sets: [{ reps: 8, weight: 60 }],
          },
          {
            exerciseId: 36,
            exerciseName: 'Тяга к поясу',
            group: 'Спина',
            kind: 'strength',
            sets: [{ reps: 10, weight: 50 }],
          },
        ],
      },
    ],
  }
}

const catalogId = (name: string) => CATALOG.find((c) => c.name === name)?.id

describe('convertLegacy', () => {
  const result = convertLegacy(sample(), CATALOG, at('2026-10-04', '12:00'))

  it('отбрасывает пустые дни и записи с пустой датой', () => {
    expect(result.workouts.map((w) => w.date).sort()).toEqual([
      '2026-05-04',
      '2026-05-06',
      '2026-05-06',
      '2026-05-10',
    ])
    expect(result.report.skippedWorkouts).toBe(2)
  })

  it('время начала — из createdAt, если тренировку записывали в тот же день', () => {
    const first = result.workouts.find((w) => w.date === '2026-05-04')
    expect(first?.startedAt).toBe(at('2026-05-04', '19:05'))
    const backfilled = result.workouts.find((w) => w.startedAt === at('2026-05-06', '12:00'))
    expect(backfilled).toBeDefined()
    expect(first?.finishedAt).toBe(first?.startedAt)
  })

  it('привязывает записи к встроенному каталогу по имени', () => {
    const bench = result.entries.filter((e) => e.exerciseId === catalogId('Жим лёжа'))
    expect(bench).toHaveLength(2)
    expect(bench[0]?.note ?? bench[1]?.note).toBe('Без страховки')
  })

  it('склеивает дубль «Подъем на носки» с каталожным «Подъём на носки»', () => {
    const calves = result.entries.find((e) => e.sets[0]?.reps === 15)
    expect(calves?.exerciseId).toBe(catalogId('Подъём на носки'))
    expect(result.exercises.some((e) => e.name === 'Подъем на носки')).toBe(false)
  })

  it('восстанавливает удалённое своё упражнение по копии имени в записи', () => {
    const custom = result.exercises.find((e) => e.name === 'Тяга гантели к поясу')
    expect(custom).toMatchObject({ custom: true, muscle: 'back', kind: 'strength' })
    expect(result.entries.some((e) => e.exerciseId === custom?.id)).toBe(true)
  })

  it('переносит неиспользованные свои упражнения и шаблоны', () => {
    const row = result.exercises.find((e) => e.name === 'Тяга к поясу')
    expect(row).toBeDefined()
    expect(result.templates).toHaveLength(1)
    expect(result.templates[0]?.exercises.map((e) => e.exerciseId)).toEqual([
      catalogId('Жим лёжа'),
      row?.id,
    ])
  })

  it('сохраняет порядок упражнений и выбрасывает пустые подходы', () => {
    const first = result.workouts.find((w) => w.date === '2026-05-04')
    const list = result.entries
      .filter((e) => e.workoutId === first?.id)
      .sort((a, b) => a.order - b.order)
    expect(list.map((e) => e.exerciseId)).toEqual([catalogId('Планка'), catalogId('Жим лёжа')])
    expect(list[0]?.sets).toHaveLength(1)
    expect(list.every((e) => e.sets.every((s) => s.done && s.type === 'normal'))).toBe(true)
  })

  it('считает итоги и рекорды по хронологии', () => {
    const first = result.workouts.find((w) => w.date === '2026-05-04')
    expect(first?.summary).toMatchObject({ exercises: 2, sets: 3, volume: 960, records: 0 })
    const second = result.workouts.find((w) => w.startedAt === at('2026-05-06', '12:00'))
    // 62,5 × 8 после 60 × 8 — рекорд и по весу, и по максимуму, и по объёму подхода.
    expect(second?.summary?.records).toBe(3)
  })

  it('файл первой версии без упражнений и шаблонов тоже читается', () => {
    const { workouts, entries } = sample()
    const partial = { workouts, entries } as unknown as LegacyData
    expect(() => convertLegacy(partial, CATALOG)).not.toThrow()
  })

  it('распознаёт файл бэкапа первой версии', () => {
    expect(isLegacyBackup({ app: 'training-diary', version: 1, ...sample() })).toBe(true)
    expect(isLegacyBackup({ app: 'training-diary', format: 2, workouts: [], entries: [] })).toBe(
      false,
    )
  })
})

/** Создаёт базу в формате первой версии: Dexie v2 = IndexedDB версии 20. */
function createLegacyDb(data: LegacyData): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(LEGACY_DB_NAME, 20)
    req.onupgradeneeded = () => {
      const idb = req.result
      for (const name of ['exercises', 'workouts', 'entries', 'templates'] as const) {
        idb.createObjectStore(name, { keyPath: 'id', autoIncrement: true })
      }
    }
    req.onerror = () => {
      reject(req.error ?? new Error('open failed'))
    }
    req.onsuccess = () => {
      const idb = req.result
      const tx = idb.transaction(['exercises', 'workouts', 'entries', 'templates'], 'readwrite')
      for (const name of ['exercises', 'workouts', 'entries', 'templates'] as const) {
        for (const row of data[name]) tx.objectStore(name).put(row)
      }
      tx.oncomplete = () => {
        idb.close()
        resolve()
      }
      tx.onerror = () => {
        reject(tx.error ?? new Error('tx failed'))
      }
    }
  })
}

function deleteDb(name: string): Promise<void> {
  return new Promise((resolve) => {
    const req = indexedDB.deleteDatabase(name)
    req.onsuccess = () => {
      resolve()
    }
    req.onerror = () => {
      resolve()
    }
  })
}

describe('migrateLegacy', () => {
  beforeEach(async () => {
    db.close()
    await deleteDb(LEGACY_DB_NAME)
    await db.delete()
    await db.open()
    await ensureCatalog()
  })

  it('без старой базы ничего не создаёт', async () => {
    expect(await readLegacyDatabase()).toBeNull()
    const names = (await indexedDB.databases()).map((d) => d.name)
    expect(names).not.toContain(LEGACY_DB_NAME)
    const state = await migrateLegacy()
    expect(state.found).toBe(false)
  })

  it('переносит один раз и не трогает старую базу', async () => {
    await createLegacyDb(sample())
    const state = await migrateLegacy()
    expect(state.report).toMatchObject({ workouts: 4, templates: 1 })
    expect(await db.workouts.count()).toBe(4)

    const again = await migrateLegacy()
    expect(again.at).toBe(state.at)
    expect(await db.workouts.count()).toBe(4)

    const legacy = await readLegacyDatabase()
    expect(legacy?.workouts).toHaveLength(6)
    expect(legacy?.entries).toHaveLength(7)
  })

  it('две вкладки разом переносят данные один раз', async () => {
    await createLegacyDb(sample())
    const [a, b] = await Promise.all([migrateLegacy(), migrateLegacy()])
    expect(a.found || b.found).toBe(true)
    expect(await db.workouts.count()).toBe(4)
  })

  it('каталог дополняется без ошибок, даже если запусков два разом', async () => {
    await db.exercises.clear()
    await Promise.all([ensureCatalog(), ensureCatalog()])
    expect(await db.exercises.count()).toBeGreaterThan(50)
  })

  it('не дублирует, если в новой базе уже есть тренировки', async () => {
    await createLegacyDb(sample())
    await db.workouts.add({
      id: 'w1',
      status: 'done',
      date: '2026-10-01',
      startedAt: 1,
      createdAt: 1,
      updatedAt: 1,
    })
    const state = await migrateLegacy()
    expect(state.found).toBe(false)
    expect(await db.workouts.count()).toBe(1)
  })
})
