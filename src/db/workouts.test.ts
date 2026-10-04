import { beforeEach, describe, expect, it } from 'vitest'
import {
  applyImport,
  collectBackup,
  createSnapshot,
  previewImport,
  restoreSnapshot,
} from './backup'
import { db } from './db'
import { createExercise, deleteExercise, mergeExercises, NameTakenError } from './exercises'
import { ensureCatalog } from './seed'
import { createTemplate, templateFromWorkout, updateTemplateFromWorkout } from './templates'
import {
  addExercises,
  addSet,
  createPastWorkout,
  deleteWorkout,
  finishWorkout,
  flushRecompute,
  getActiveWorkout,
  lastSession,
  removeSet,
  restoreSet,
  restoreWorkout,
  startWorkout,
  toggleSetDone,
  updateSet,
  workoutRecords,
} from './workouts'

const BENCH = 'c:bench-press'
const PULLUPS = 'c:pull-ups'

beforeEach(async () => {
  await db.delete()
  await db.open()
  await ensureCatalog()
})

async function entriesOf(workoutId: string) {
  return db.entries.where('workoutId').equals(workoutId).sortBy('order')
}

/** Тренировка с жимом: подходы [вес, повторы]. */
async function benchWorkout(sets: [number, number][]) {
  const id = await startWorkout()
  await addExercises(id, [BENCH])
  const [entry] = await entriesOf(id)
  if (!entry) throw new Error('no entry')
  // Подстраиваем число подходов.
  while ((await db.entries.get(entry.id))?.sets.length !== sets.length) {
    const cur = await db.entries.get(entry.id)
    if ((cur?.sets.length ?? 0) < sets.length) await addSet(entry.id)
    else await removeSet(entry.id, cur?.sets.at(-1)?.id ?? '')
  }
  const fresh = await db.entries.get(entry.id)
  for (const [i, [weight, reps]] of sets.entries()) {
    const set = fresh?.sets[i]
    if (!set) continue
    await updateSet(entry.id, set.id, { weight, reps })
    await toggleSetDone(entry.id, set.id, 'strength')
  }
  await finishWorkout(id, { countFilled: false })
  return id
}

describe('тренировка', () => {
  it('активная может быть только одна', async () => {
    const a = await startWorkout()
    const b = await startWorkout()
    expect(b).toBe(a)
    expect((await getActiveWorkout())?.id).toBe(a)
  })

  it('новое упражнение повторяет структуру прошлого раза, но с пустыми ячейками', async () => {
    await benchWorkout([
      [60, 8],
      [60, 8],
      [60, 6],
    ])
    const id = await startWorkout()
    await addExercises(id, [BENCH])
    const [entry] = await entriesOf(id)
    expect(entry?.sets).toHaveLength(3)
    expect(entry?.sets.every((s) => !s.done && s.weight === undefined)).toBe(true)
    const last = await lastSession(BENCH, Date.now() + 1, id)
    expect(last?.sets.map((s) => s.weight)).toEqual([60, 60, 60])
  })

  it('отметка пустого подхода берёт подсказку прошлого раза', async () => {
    const id = await startWorkout()
    await addExercises(id, [BENCH])
    const [entry] = await entriesOf(id)
    const set = entry?.sets[0]
    if (!entry || !set) throw new Error('no set')
    expect(await toggleSetDone(entry.id, set.id, 'strength')).toBe('incomplete')
    expect(await toggleSetDone(entry.id, set.id, 'strength', { weight: 50, reps: 10 })).toBe('done')
    const updated = (await db.entries.get(entry.id))?.sets[0]
    expect(updated).toMatchObject({ weight: 50, reps: 10, done: true })
    expect(await toggleSetDone(entry.id, set.id, 'strength')).toBe('undone')
  })

  it('завершение выбрасывает пустые подходы и упражнения, заполненные — по выбору', async () => {
    const id = await startWorkout()
    await addExercises(id, [BENCH, PULLUPS])
    const [bench, pullups] = await entriesOf(id)
    if (!bench || !pullups) throw new Error('no entries')
    const [s1, s2] = bench.sets
    await updateSet(bench.id, s1?.id ?? '', { weight: 60, reps: 8 })
    await toggleSetDone(bench.id, s1?.id ?? '', 'strength')
    await updateSet(bench.id, s2?.id ?? '', { weight: 60, reps: 8 }) // заполнен, не отмечен
    await finishWorkout(id, { countFilled: true })
    const left = await entriesOf(id)
    expect(left.map((e) => e.exerciseId)).toEqual([BENCH])
    expect(left[0]?.sets).toHaveLength(2)
    const w = await db.workouts.get(id)
    expect(w?.status).toBe('done')
    expect(w?.summary).toMatchObject({ exercises: 1, sets: 2, volume: 960 })
  })

  it('рекорды считаются относительно прошлых тренировок', async () => {
    await benchWorkout([[60, 8]])
    const second = await benchWorkout([
      [60, 8],
      [62.5, 8],
    ])
    const records = await workoutRecords(second)
    expect(records).toHaveLength(1)
    expect(records[0]?.types).toEqual(['e1rm', 'weight', 'setVolume'])
    expect((await db.workouts.get(second))?.summary?.records).toBe(3)
  })

  it('быстрые правки одного упражнения не затирают друг друга', async () => {
    const id = await startWorkout()
    await addExercises(id, [BENCH])
    const [entry] = await entriesOf(id)
    const [a, b] = entry?.sets ?? []
    // Как быстрые нажатия: запросы уходят, не дожидаясь друг друга.
    await Promise.all([
      updateSet(entry?.id ?? '', a?.id ?? '', { weight: 8 }),
      updateSet(entry?.id ?? '', a?.id ?? '', { weight: 80 }),
      updateSet(entry?.id ?? '', a?.id ?? '', { reps: 8 }),
      updateSet(entry?.id ?? '', b?.id ?? '', { weight: 70, reps: 6 }),
    ])
    const sets = (await db.entries.get(entry?.id ?? ''))?.sets
    expect(sets?.[0]).toMatchObject({ weight: 80, reps: 8 })
    expect(sets?.[1]).toMatchObject({ weight: 70, reps: 6 })
  })

  it('удаление подхода и тренировки можно отменить', async () => {
    const id = await benchWorkout([
      [60, 8],
      [60, 8],
    ])
    const [entry] = await entriesOf(id)
    const removed = await removeSet(entry?.id ?? '', entry?.sets[0]?.id ?? '')
    expect((await db.entries.get(entry?.id ?? ''))?.sets).toHaveLength(1)
    if (removed) await restoreSet(removed)
    expect((await db.entries.get(entry?.id ?? ''))?.sets[0]?.id).toBe(entry?.sets[0]?.id)

    const deleted = await deleteWorkout(id)
    expect(await db.workouts.count()).toBe(0)
    if (deleted) await restoreWorkout(deleted)
    expect(await db.entries.where('workoutId').equals(id).count()).toBe(1)
  })

  it('прошлую тренировку можно внести задним числом', async () => {
    const id = await createPastWorkout('2026-09-30', '19:00')
    await addExercises(id, [BENCH])
    const [entry] = await entriesOf(id)
    await updateSet(entry?.id ?? '', entry?.sets[0]?.id ?? '', { weight: 70, reps: 5, done: true })
    await flushRecompute()
    const w = await db.workouts.get(id)
    expect(w?.date).toBe('2026-09-30')
    expect(w?.summary?.volume).toBe(350)
  })
})

describe('программы', () => {
  it('тренировка по программе берёт её структуру', async () => {
    const tpl = await createTemplate('День A', [
      {
        id: 't1',
        exerciseId: BENCH,
        sets: [{ type: 'warmup' }, { type: 'normal', weight: 60, reps: 8 }],
      },
      { id: 't2', exerciseId: PULLUPS, sets: [{ type: 'normal' }] },
    ])
    const id = await startWorkout({ templateId: tpl })
    const w = await db.workouts.get(id)
    expect(w).toMatchObject({ title: 'День A', templateId: tpl })
    const entries = await entriesOf(id)
    expect(entries.map((e) => e.sets.map((s) => s.type))).toEqual([
      ['warmup', 'normal'],
      ['normal'],
    ])
    expect((await db.templates.get(tpl))?.lastUsedAt).toBeDefined()
  })

  it('обновление программы не теряет пропущенные упражнения', async () => {
    const tpl = await createTemplate('День A', [
      { id: 't1', exerciseId: BENCH, sets: [{ type: 'normal', weight: 60, reps: 8 }] },
      { id: 't2', exerciseId: PULLUPS, sets: [{ type: 'normal', reps: 10 }] },
    ])
    const id = await startWorkout({ templateId: tpl })
    const [bench] = await entriesOf(id)
    const set = bench?.sets[0]
    await updateSet(bench?.id ?? '', set?.id ?? '', { weight: 65, reps: 8 })
    await toggleSetDone(bench?.id ?? '', set?.id ?? '', 'strength')
    await addExercises(id, ['c:plank'])
    const plank = (await entriesOf(id)).find((e) => e.exerciseId === 'c:plank')
    await updateSet(plank?.id ?? '', plank?.sets[0]?.id ?? '', { seconds: 60 })
    await toggleSetDone(plank?.id ?? '', plank?.sets[0]?.id ?? '', 'timed')
    await finishWorkout(id, { countFilled: false })

    await updateTemplateFromWorkout(tpl, id)
    const t = await db.templates.get(tpl)
    expect(t?.exercises.map((e) => e.exerciseId)).toEqual([BENCH, PULLUPS, 'c:plank'])
    expect(t?.exercises[0]?.sets).toEqual([{ type: 'normal', weight: 65, reps: 8 }])
    expect(t?.exercises[1]?.sets).toEqual([{ type: 'normal', reps: 10 }])
  })

  it('программа из тренировки сохраняет выполненные подходы', async () => {
    const id = await benchWorkout([
      [60, 8],
      [65, 6],
    ])
    const tpl = await templateFromWorkout(id, 'Жим')
    const t = await db.templates.get(tpl)
    expect(t?.exercises[0]?.sets).toEqual([
      { type: 'normal', weight: 60, reps: 8 },
      { type: 'normal', weight: 65, reps: 6 },
    ])
  })
})

describe('упражнения', () => {
  it('не даёт завести дубль по имени с точностью до «ё»', async () => {
    await expect(
      createExercise({
        name: 'подъем на носки',
        muscle: 'legs',
        kind: 'strength',
        equipment: 'machine',
      }),
    ).rejects.toBeInstanceOf(NameTakenError)
  })

  it('объединение переносит историю и удаляет свой дубль', async () => {
    const dup = await createExercise({
      name: 'Жим штанги лёжа',
      muscle: 'chest',
      kind: 'strength',
      equipment: 'barbell',
    })
    const id = await startWorkout()
    await addExercises(id, [dup])
    const [entry] = await entriesOf(id)
    await updateSet(entry?.id ?? '', entry?.sets[0]?.id ?? '', { weight: 80, reps: 5 })
    await toggleSetDone(entry?.id ?? '', entry?.sets[0]?.id ?? '', 'strength')
    await finishWorkout(id, { countFilled: false })
    expect(await deleteExercise(dup)).toBe(false) // есть история — только архив или объединение
    await mergeExercises(dup, BENCH)
    expect(await db.exercises.get(dup)).toBeUndefined()
    expect((await entriesOf(id))[0]?.exerciseId).toBe(BENCH)
  })
})

describe('резервная копия', () => {
  it('экспорт и импорт дают те же данные', async () => {
    await benchWorkout([[60, 8]])
    await createTemplate('Пустая')
    const backup = await collectBackup()
    const preview = previewImport(JSON.stringify(backup))
    expect(preview).toMatchObject({ source: 'v2', workouts: 1, templates: 1, dropped: 0 })

    await db.workouts.clear()
    await db.entries.clear()
    await applyImport(preview)
    expect(await db.workouts.count()).toBe(1)
    expect(await db.entries.count()).toBe(1)
    // Перед импортом — снимок того, что было.
    const snaps = await db.snapshots.toArray()
    expect(snaps.map((s) => s.reason)).toEqual(['before-import'])
  })

  it('снимок восстанавливается', async () => {
    await benchWorkout([[60, 8]])
    await createSnapshot('auto')
    await db.workouts.clear()
    const [snap] = await db.snapshots.toArray()
    await restoreSnapshot(snap?.id ?? '')
    expect(await db.workouts.count()).toBe(1)
  })

  it('понятная ошибка на чужой файл', () => {
    expect(() => previewImport('not json')).toThrow(/JSON/)
    expect(() => previewImport('{"hello": 1}')).toThrow(/не похож/)
  })

  it('битые записи отбрасываются, а не ломают импорт', async () => {
    const backup = await collectBackup()
    const broken = {
      ...backup,
      workouts: [...backup.workouts, { id: 'x', date: '', startedAt: 'вчера' }],
      entries: [
        ...backup.entries,
        { id: 'y', workoutId: 'нет такой', exerciseId: BENCH, sets: [] },
      ],
    }
    const preview = previewImport(JSON.stringify(broken))
    expect(preview.dropped).toBe(2)
  })
})
