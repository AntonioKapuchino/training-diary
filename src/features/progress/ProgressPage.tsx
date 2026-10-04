import { useLiveQuery } from 'dexie-react-hooks'
import { ChartNoAxesColumn, ChevronRight, Scale, Trophy } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useAllEntries, useBodyLogs, useDoneWorkouts, useExerciseMap } from '@/db/hooks'
import { workoutRecords } from '@/db/workouts'
import {
  addDays,
  addMonths,
  formatDayMonthShort,
  formatMonthYear,
  formatRelativeDay,
  startOfMonth,
  startOfWeek,
  todayISO,
} from '@/domain/dates'
import { formatDuration, formatNumber, formatVolume, formatWeight, plural } from '@/domain/format'
import { MUSCLE_LABEL, MUSCLES, muscleColor } from '@/domain/labels'
import { RECORD_LABEL } from '@/domain/records'
import { muscleSetCounts, sessionPoint, workoutSeconds, type SessionPoint } from '@/domain/stats'
import type { Exercise, Workout, WorkoutEntry, WorkoutSet } from '@/domain/types'
import { Bars, type Bar } from '@/ui/charts/Bars'
import { HBars } from '@/ui/charts/HBars'
import { Sparkline } from '@/ui/charts/Sparkline'
import { EmptyState } from '@/ui/EmptyState'
import { Section } from '@/ui/List'
import { MuscleDot } from '@/ui/MuscleDot'
import { Page } from '@/ui/Page'
import { Segmented } from '@/ui/Segmented'

type Period = '4w' | '3m' | '6m' | '1y'
const PERIODS: { value: Period; label: string }[] = [
  { value: '4w', label: '4 нед' },
  { value: '3m', label: '3 мес' },
  { value: '6m', label: '6 мес' },
  { value: '1y', label: 'Год' },
]
const DAYS: Record<Period, number> = { '4w': 28, '3m': 91, '6m': 182, '1y': 364 }

type BarMetric = 'count' | 'volume' | 'time'

function within(w: Workout, from: string, to: string) {
  return w.date >= from && w.date <= to
}

export function ProgressPage() {
  const workouts = useDoneWorkouts()
  const entries = useAllEntries()
  const exercises = useExerciseMap()
  const bodyLogs = useBodyLogs()
  const [period, setPeriod] = useState<Period>('3m')
  const [barMetric, setBarMetric] = useState<BarMetric>('count')

  const today = todayISO()
  const from = addDays(today, -DAYS[period] + 1)
  const prevFrom = addDays(from, -DAYS[period])
  const prevTo = addDays(from, -1)

  const current = useMemo(
    () => (workouts ?? []).filter((w) => within(w, from, today)),
    [workouts, from, today],
  )
  const previous = useMemo(
    () => (workouts ?? []).filter((w) => within(w, prevFrom, prevTo)),
    [workouts, prevFrom, prevTo],
  )

  const totals = (list: Workout[]) => ({
    count: list.length,
    seconds: list.reduce((s, w) => s + workoutSeconds(w), 0),
    volume: list.reduce((s, w) => s + (w.summary?.volume ?? 0), 0),
    sets: list.reduce((s, w) => s + (w.summary?.sets ?? 0), 0),
  })
  const now = totals(current)
  const before = totals(previous)

  const bars = useMemo<Bar[]>(() => {
    const value = (list: Workout[]) =>
      barMetric === 'count'
        ? list.length
        : barMetric === 'volume'
          ? list.reduce((s, w) => s + (w.summary?.volume ?? 0), 0)
          : list.reduce((s, w) => s + workoutSeconds(w), 0) / 60
    if (period === '1y') {
      // За год — по месяцам: 52 столбика слишком тонкие.
      return Array.from({ length: 12 }, (_, i) => {
        const m = addMonths(startOfMonth(today), i - 11)
        const next = addMonths(m, 1)
        const list = current.filter((w) => w.date >= m && w.date < next)
        return {
          key: m,
          value: value(list),
          label: formatMonthYear(m, today).slice(0, 3),
          title: formatMonthYear(m, today),
          highlight: i === 11,
        }
      })
    }
    const weeks = Math.ceil(DAYS[period] / 7)
    const last = startOfWeek(today)
    return Array.from({ length: weeks }, (_, i) => {
      const w = addDays(last, (i - weeks + 1) * 7)
      const end = addDays(w, 6)
      const list = (workouts ?? []).filter((x) => x.date >= w && x.date <= end)
      return {
        key: w,
        value: value(list),
        label: formatDayMonthShort(w).replace('.', ''),
        title: `Неделя с ${formatDayMonthShort(w)}`,
        highlight: i === weeks - 1,
      }
    })
  }, [period, barMetric, workouts, current, today])

  const doneIds = useMemo(() => new Set(current.map((w) => w.id)), [current])
  const periodEntries = useMemo(
    () => (entries ?? []).filter((e) => doneIds.has(e.workoutId)),
    [entries, doneIds],
  )

  const muscleBars = useMemo(() => {
    if (!exercises) return []
    const counts = muscleSetCounts(
      periodEntries.flatMap((e) => {
        const ex = exercises.get(e.exerciseId)
        return ex ? [{ kind: ex.kind, muscle: ex.muscle, sets: e.sets }] : []
      }),
    )
    return MUSCLES.filter((m) => (counts.get(m) ?? 0) > 0)
      .map((m) => ({
        key: m,
        label: MUSCLE_LABEL[m],
        value: counts.get(m) ?? 0,
        color: muscleColor(m),
      }))
      .sort((a, b) => b.value - a.value)
  }, [periodEntries, exercises])

  if (workouts?.length === 0) {
    return (
      <Page title="Прогресс">
        <EmptyState
          icon={<ChartNoAxesColumn />}
          title="Здесь будут графики"
          message="После пары тренировок появятся динамика по неделям, баланс групп мышц и рекорды."
        />
        <BodyCard logs={bodyLogs} />
      </Page>
    )
  }

  const fmtBar = (v: number) =>
    barMetric === 'count'
      ? formatNumber(v, 0)
      : barMetric === 'volume'
        ? v >= 10_000
          ? `${formatNumber(v / 1000, 1)}т`
          : formatNumber(v, 0)
        : `${formatNumber(v, 0)}м`

  return (
    <Page title="Прогресс">
      <div className="px-4 pb-1">
        <Segmented label="Период" value={period} options={PERIODS} onChange={setPeriod} />
      </div>

      <div className="mx-4 mt-3 grid grid-cols-2 gap-2.5">
        <Kpi
          label="Тренировки"
          value={String(now.count)}
          delta={now.count - before.count}
          fmt={(d) => formatNumber(d, 0)}
        />
        <Kpi
          label="Время"
          value={now.seconds > 0 ? formatDuration(now.seconds) : '—'}
          delta={(now.seconds - before.seconds) / 3600}
          fmt={(d) => `${formatNumber(d, 1)} ч`}
        />
        <Kpi
          label="Объём"
          value={formatVolume(now.volume)}
          delta={now.volume - before.volume}
          fmt={(d) => formatVolume(d)}
        />
        <Kpi
          label="Подходы"
          value={String(now.sets)}
          delta={now.sets - before.sets}
          fmt={(d) => formatNumber(d, 0)}
        />
      </div>

      <Section plain className="mt-5">
        <div className="rounded-[var(--radius-card)] bg-surface p-4 shadow-[var(--shadow-card)]">
          <Segmented
            label="Что показывать"
            value={barMetric}
            options={[
              { value: 'count', label: 'Тренировки' },
              { value: 'volume', label: 'Объём' },
              { value: 'time', label: 'Время' },
            ]}
            onChange={setBarMetric}
          />
          <div className="mt-4">
            <Bars
              bars={bars}
              format={fmtBar}
              label={`${period === '1y' ? 'По месяцам' : 'По неделям'}: ${barMetric === 'count' ? 'тренировки' : barMetric === 'volume' ? 'объём' : 'время'}`}
            />
          </div>
        </div>
      </Section>

      {muscleBars.length > 0 && (
        <Section title="Группы мышц" plain>
          <div className="rounded-[var(--radius-card)] bg-surface p-4 shadow-[var(--shadow-card)]">
            <p className="mb-3 text-footnote text-label-2">Рабочие подходы за период</p>
            <HBars bars={muscleBars} format={(v) => formatNumber(v, 0)} />
          </div>
        </Section>
      )}

      <RecentRecords workouts={workouts ?? []} exercises={exercises} />

      <ExerciseTrends entries={periodEntries} workouts={current} exercises={exercises} />

      <BodyCard logs={bodyLogs} />
    </Page>
  )
}

function Kpi({
  label,
  value,
  delta,
  fmt,
}: {
  label: string
  value: string
  delta: number
  fmt: (d: number) => string
}) {
  const sign = delta > 0 ? '+' : delta < 0 ? '−' : ''
  return (
    <div className="rounded-[var(--radius-card)] bg-surface px-4 py-3 shadow-[var(--shadow-card)]">
      <div className="text-footnote text-label-2">{label}</div>
      <div className="mt-0.5 font-rounded text-title-2 font-bold">{value}</div>
      <div className={`mt-0.5 text-caption ${delta > 0 ? 'text-success' : 'text-label-2'}`}>
        {Math.abs(delta) < 0.05
          ? 'как в прошлом периоде'
          : `${sign}${fmt(Math.abs(delta))} к прошлому`}
      </div>
    </div>
  )
}

/** Последние рекорды — из итогов тренировок, подробности по подходам. */
function RecentRecords({
  workouts,
  exercises,
}: {
  workouts: Workout[]
  exercises: ReadonlyMap<string, Exercise> | undefined
}) {
  const withRecords = workouts.filter((w) => (w.summary?.records ?? 0) > 0).slice(0, 4)
  const key = withRecords.map((w) => `${w.id}:${w.updatedAt}`).join(',')
  const items = useLiveQuery(async () => {
    const out: { workout: Workout; exerciseId: string; types: string[] }[] = []
    for (const w of withRecords) {
      const recs = await workoutRecords(w.id)
      const byExercise = new Map<string, Set<string>>()
      for (const r of recs) {
        const set = byExercise.get(r.exerciseId) ?? new Set<string>()
        for (const t of r.types) set.add(RECORD_LABEL[t].toLowerCase())
        byExercise.set(r.exerciseId, set)
      }
      for (const [exerciseId, types] of byExercise)
        out.push({ workout: w, exerciseId, types: [...types] })
    }
    return out.slice(0, 6)
  }, [key])
  if (!items || items.length === 0 || !exercises) return null
  return (
    <Section title="Рекорды">
      {items.map((it) => {
        const ex = exercises.get(it.exerciseId)
        if (!ex) return null
        return (
          <Link
            key={`${it.workout.id}-${it.exerciseId}`}
            to={`/exercises/${ex.id}`}
            className="flex items-center gap-3 pressable px-4 py-3 [&+&]:hairline-t"
          >
            <Trophy className="size-5 shrink-0 text-warning" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-body">{ex.name}</span>
              <span className="block truncate text-footnote text-label-2">
                {it.types.join(', ')}
              </span>
            </span>
            <span className="shrink-0 text-footnote text-label-2">
              {formatRelativeDay(it.workout.date)}
            </span>
          </Link>
        )
      })}
    </Section>
  )
}

/** Упражнения периода: тренд главного показателя и изменение с первой тренировки. */
function ExerciseTrends({
  entries,
  workouts,
  exercises,
}: {
  entries: readonly WorkoutEntry[]
  workouts: Workout[]
  exercises: ReadonlyMap<string, Exercise> | undefined
}) {
  const rows = useMemo(() => {
    if (!exercises) return []
    const startedAt = new Map(workouts.map((w) => [w.id, w.startedAt]))
    const byExercise = new Map<string, Map<string, WorkoutSet[]>>()
    for (const e of entries) {
      const sessions = byExercise.get(e.exerciseId) ?? new Map<string, WorkoutSet[]>()
      sessions.set(e.workoutId, [...(sessions.get(e.workoutId) ?? []), ...e.sets])
      byExercise.set(e.exerciseId, sessions)
    }
    return [...byExercise.entries()]
      .flatMap(([id, sessions]) => {
        const ex = exercises.get(id)
        if (!ex) return []
        const points = [...sessions.entries()]
          .map(([wid, sets]) => sessionPoint(ex.kind, wid, startedAt.get(wid) ?? 0, sets))
          .filter((p): p is SessionPoint => p !== null)
          .sort((a, b) => a.startedAt - b.startedAt)
        if (points.length === 0) return []
        const key =
          ex.kind === 'strength'
            ? 'e1rm'
            : ex.kind === 'bodyweight'
              ? 'reps'
              : ex.kind === 'timed'
                ? 'duration'
                : 'distance'
        const values = points.map((p) => p[key])
        return [{ ex, values, sessions: points.length, last: points.at(-1)?.startedAt ?? 0 }]
      })
      .sort((a, b) => b.sessions - a.sessions || b.last - a.last)
      .slice(0, 8)
  }, [entries, workouts, exercises])

  if (rows.length === 0) return null
  return (
    <Section
      title="Упражнения"
      footer="Для силовых — расчётный максимум, для своего веса — повторы"
    >
      {rows.map(({ ex, values, sessions }) => {
        const first = values[0] ?? 0
        const last = values.at(-1) ?? 0
        const change = first > 0 ? ((last - first) / first) * 100 : 0
        return (
          <Link
            key={ex.id}
            to={`/exercises/${ex.id}`}
            className="flex items-center gap-3 pressable pl-4 [&+&>span]:hairline-t"
          >
            <span className="flex min-h-14 min-w-0 flex-1 items-center gap-3 py-2 pr-3">
              <MuscleDot muscle={ex.muscle} size={10} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-body">{ex.name}</span>
                <span className="block text-footnote text-label-2">
                  {sessions} {plural(sessions, 'раз', 'раза', 'раз')}
                  {values.length > 1 && Math.abs(change) >= 0.5 && (
                    <span className={change > 0 ? 'text-success' : undefined}>
                      {' '}
                      · {change > 0 ? '+' : '−'}
                      {formatNumber(Math.abs(change), 0)}%
                    </span>
                  )}
                </span>
              </span>
              <Sparkline values={values} color={muscleColor(ex.muscle)} />
              <ChevronRight
                className="size-[1.125rem] shrink-0 text-label-3"
                strokeWidth={2.5}
                aria-hidden
              />
            </span>
          </Link>
        )
      })}
    </Section>
  )
}

function BodyCard({ logs }: { logs: ReturnType<typeof useBodyLogs> }) {
  const withWeight = (logs ?? []).filter((l) => l.weight !== undefined)
  const last = withWeight.at(-1)
  return (
    <Section title="Тело" plain>
      <Link
        to="/progress/body"
        className="flex press-scale items-center gap-3 rounded-[var(--radius-card)] bg-surface p-4 shadow-[var(--shadow-card)]"
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
          <Scale className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-body font-semibold">Вес тела</span>
          <span className="block text-footnote text-label-2">
            {last?.weight !== undefined
              ? `${formatWeight(last.weight)} · ${formatRelativeDay(last.date)}`
              : 'Записывай вес — увидишь динамику'}
          </span>
        </span>
        {withWeight.length > 1 && (
          <Sparkline
            values={withWeight.slice(-12).map((l) => l.weight ?? 0)}
            color="var(--accent)"
          />
        )}
        <ChevronRight
          className="size-[1.125rem] shrink-0 text-label-3"
          strokeWidth={2.5}
          aria-hidden
        />
      </Link>
    </Section>
  )
}
