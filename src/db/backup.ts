import { formatTime, todayISO } from '@/domain/dates'
import { newId } from '@/domain/ids'
import { MUSCLE_LABEL, SET_TYPE_LABEL } from '@/domain/labels'
import { getSettings, sanitizeSettings, updateSettings } from '@/settings/settings'
import { cleanBackup, isBackupV2, validTimestamp, type BackupV2 } from './backup-format'
import { CATALOG } from './catalog'
import { db, getMeta, setMeta, type Snapshot, type SnapshotReason } from './db'
import { convertLegacy, isLegacyBackup } from './legacy'
import { ensureCatalog } from './seed'
import { recomputeAllSummaries, SUMMARIES_DIRTY } from './summaries'
import { flushRecompute } from './workouts'

export async function collectBackup(): Promise<BackupV2> {
  await flushRecompute()
  const [exercises, workouts, entries, templates, bodyLogs] = await Promise.all([
    db.exercises.toArray(),
    db.workouts.toArray(),
    db.entries.toArray(),
    db.templates.toArray(),
    db.bodyLogs.toArray(),
  ])
  return {
    app: 'training-diary',
    format: 2,
    exportedAt: new Date().toISOString(),
    appVersion: __APP_VERSION__,
    exercises,
    workouts,
    entries,
    templates,
    bodyLogs,
    settings: { ...getSettings() },
  }
}

export function backupFileName(date = todayISO()): string {
  return `тренировки-${date}.json`
}

export async function backupFile(): Promise<File> {
  const data = await collectBackup()
  return new File([JSON.stringify(data)], backupFileName(), { type: 'application/json' })
}

const LAST_EXPORT = 'lastExportAt'

export async function markExported(): Promise<void> {
  await setMeta(LAST_EXPORT, Date.now())
}

export async function lastExportAt(): Promise<number | undefined> {
  return getMeta<number>(LAST_EXPORT)
}

/** Таблица для Excel и Numbers: строка на подход, разделитель «;», BOM для кириллицы. */
export async function csvFile(): Promise<File> {
  const [workouts, entries, exercises] = await Promise.all([
    db.workouts.where('status').equals('done').toArray(),
    db.entries.toArray(),
    db.exercises.toArray(),
  ])
  const ex = new Map(exercises.map((e) => [e.id, e]))
  const byWorkout = new Map<string, typeof entries>()
  for (const e of entries) byWorkout.set(e.workoutId, [...(byWorkout.get(e.workoutId) ?? []), e])
  const cell = (v: string | number | undefined) => {
    let s = v === undefined ? '' : typeof v === 'number' ? String(v).replace('.', ',') : v
    // Заметка «+2,5 кг в след. раз» иначе откроется в Excel как формула.
    if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`
    return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const rows = [
    [
      'Дата',
      'Начало',
      'Тренировка',
      'Упражнение',
      'Группа',
      'Подход',
      'Тип',
      'Вес, кг',
      'Повторы',
      'Время, сек',
      'Дистанция, км',
      'Заметка',
    ],
  ]
  for (const w of workouts.sort((a, b) => a.startedAt - b.startedAt)) {
    for (const e of (byWorkout.get(w.id) ?? []).sort((a, b) => a.order - b.order)) {
      const exercise = ex.get(e.exerciseId)
      e.sets
        .filter((s) => s.done)
        .forEach((s, i) => {
          rows.push(
            [
              w.date,
              formatTime(w.startedAt),
              w.title ?? '',
              exercise?.name ?? '',
              exercise ? MUSCLE_LABEL[exercise.muscle] : '',
              i + 1,
              SET_TYPE_LABEL[s.type],
              s.weight,
              s.reps,
              s.seconds,
              s.distance,
              i === 0 ? (e.note ?? '') : '',
            ].map(cell),
          )
        })
    }
  }
  const text = '﻿' + rows.map((r) => r.join(';')).join('\r\n')
  return new File([text], `тренировки-${todayISO()}.csv`, { type: 'text/csv' })
}

export class ImportError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ImportError'
  }
}

export interface ImportPreview {
  source: 'v2' | 'legacy'
  data: BackupV2
  workouts: number
  templates: number
  customExercises: number
  bodyLogs: number
  firstDate?: string
  lastDate?: string
  exportedAt?: string
  /** Битые записи, которые не войдут. */
  dropped: number
}

function exportedAtOf(raw: unknown): string {
  const v = (raw as { exportedAt?: unknown }).exportedAt
  return typeof v === 'string' ? v : ''
}

function isNewerBackup(raw: unknown): boolean {
  const o = raw as { app?: unknown; format?: unknown } | null
  return (
    typeof o === 'object' &&
    o !== null &&
    o.app === 'training-diary' &&
    typeof o.format === 'number' &&
    o.format > 2
  )
}

/** Разбирает файл и показывает, что в нём, — ничего не записывая. */
export function previewImport(text: string): ImportPreview {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new ImportError('Это не файл резервной копии: не получилось прочитать JSON.')
  }
  let data: BackupV2
  let dropped: number
  let source: ImportPreview['source']
  if (isBackupV2(raw)) {
    const cleaned = cleanBackup(raw)
    data = cleaned.data
    dropped = cleaned.report.dropped
    source = 'v2'
  } else if (isLegacyBackup(raw)) {
    const converted = convertLegacy(raw, CATALOG)
    data = {
      app: 'training-diary',
      format: 2,
      exportedAt: exportedAtOf(raw),
      appVersion: '1',
      exercises: converted.exercises,
      workouts: converted.workouts,
      entries: converted.entries,
      templates: converted.templates,
      bodyLogs: [],
    }
    dropped = converted.report.skippedWorkouts
    source = 'legacy'
  } else if (isNewerBackup(raw)) {
    throw new ImportError(
      'Копию сделала более новая версия дневника. Обнови приложение — закрой его и открой снова — и загрузи файл ещё раз.',
    )
  } else {
    throw new ImportError('Файл не похож на резервную копию дневника тренировок.')
  }
  const dates = data.workouts.map((w) => w.date).sort()
  return {
    source,
    data,
    workouts: data.workouts.length,
    templates: data.templates.length,
    customExercises: data.exercises.filter((e) => e.custom).length,
    bodyLogs: data.bodyLogs.length,
    ...(dates[0] ? { firstDate: dates[0] } : {}),
    ...(dates.at(-1) ? { lastDate: dates.at(-1) } : {}),
    ...(validTimestamp(data.exportedAt) ? { exportedAt: data.exportedAt } : {}),
    dropped,
  }
}

/** Заменяет все данные копией. Перед этим текущие данные сохраняются в снимок. */
async function replaceAll(data: BackupV2): Promise<void> {
  await db.transaction(
    'rw',
    [db.exercises, db.workouts, db.entries, db.templates, db.bodyLogs, db.meta],
    async () => {
      // Итоги загруженных тренировок пересчитаются ниже; не успеют — при следующем запуске.
      await db.meta.put({ key: SUMMARIES_DIRTY, value: true })
      await Promise.all([
        db.exercises.clear(),
        db.workouts.clear(),
        db.entries.clear(),
        db.templates.clear(),
        db.bodyLogs.clear(),
      ])
      await db.exercises.bulkPut(data.exercises)
      await db.workouts.bulkPut(data.workouts)
      await db.entries.bulkPut(data.entries)
      await db.templates.bulkPut(data.templates)
      await db.bodyLogs.bulkPut(data.bodyLogs)
    },
  )
  await ensureCatalog()
  await recomputeAllSummaries()
  if (data.settings) updateSettings(sanitizeSettings(data.settings))
}

export async function applyImport(preview: ImportPreview): Promise<void> {
  await createSnapshot('before-import')
  await replaceAll(preview.data)
}

const MAX_SNAPSHOTS = 6

export async function createSnapshot(reason: SnapshotReason): Promise<void> {
  const data = await collectBackup()
  const snap: Snapshot = {
    id: newId(),
    createdAt: Date.now(),
    reason,
    workouts: data.workouts.filter((w) => w.status === 'done').length,
    data,
  }
  await db.snapshots.add(snap)
  const all = await db.snapshots.orderBy('createdAt').reverse().primaryKeys()
  if (all.length > MAX_SNAPSHOTS) await db.snapshots.bulkDelete(all.slice(MAX_SNAPSHOTS))
}

export async function restoreSnapshot(id: string): Promise<void> {
  const snap = await db.snapshots.get(id)
  if (!snap) return
  await createSnapshot('before-restore')
  await replaceAll(cleanBackup(snap.data).data)
}

/** Раз в неделю — снимок внутри приложения, на случай собственной ошибки. */
export async function autoSnapshot(): Promise<void> {
  const last = await db.snapshots.orderBy('createdAt').last()
  const week = 7 * 86_400_000
  const workouts = await db.workouts.count()
  if (workouts === 0) return
  if (last && Date.now() - last.createdAt < week) return
  await createSnapshot('auto')
}

/**
 * Пора ли напомнить о резервной копии: давно не сохранял, а с тех пор что-то изменилось —
 * новая тренировка, внесённая задним числом, правка старой или замер тела.
 */
export async function backupDue(
  reminderDays: number,
): Promise<{ due: boolean; days: number | null }> {
  if (reminderDays <= 0) return { due: false, days: null }
  const last = await lastExportAt()
  const done = await db.workouts.where('status').equals('done').toArray()
  if (done.length === 0) return { due: false, days: null }
  if (last === undefined) return { due: done.length >= 3, days: null }
  const bodyLogs = await db.bodyLogs.toArray()
  const changedAt = [...done, ...bodyLogs].reduce((m, x) => Math.max(m, x.updatedAt), 0)
  const days = Math.floor((Date.now() - last) / 86_400_000)
  return { due: days >= reminderDays && changedAt > last, days }
}
