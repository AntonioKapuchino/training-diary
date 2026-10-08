import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronRight, Share, Trophy } from 'lucide-react'
import { useMemo } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router'
import { useAllEntries, useDoneWorkouts, useExerciseMap } from '@/db/hooks'
import { workoutRecords } from '@/db/workouts'
import {
  addMonths,
  formatDayMonth,
  formatMonthYear,
  isISODate,
  monthPrepositional,
  startOfMonth,
  todayISO,
} from '@/domain/dates'
import {
  countLabel,
  formatDuration,
  formatNumber,
  formatVolume,
  formatWeight,
  plural,
} from '@/domain/format'
import { MUSCLE_LABEL, muscleColor } from '@/domain/labels'
import { monthReport, type MonthReport, type MonthTotals } from '@/domain/month'
import { RECORD_LABEL } from '@/domain/records'
import type { Exercise, MuscleGroup, Workout } from '@/domain/types'
import { shareOrDownload } from '@/lib/share'
import { useBusy } from '@/lib/useBusy'
import { useSettings } from '@/settings/settings'
import { Button, IconButton } from '@/ui/Button'
import { HBars } from '@/ui/charts/HBars'
import { EmptyState } from '@/ui/EmptyState'
import { Section } from '@/ui/List'
import { MuscleDot } from '@/ui/MuscleDot'
import { Page } from '@/ui/Page'
import { toast } from '@/ui/Toast'
import { MonthCalendar } from '../history/MonthCalendar'
import { workoutTitle } from '../history/WorkoutRow'
import { monthImage } from './monthImage'

/** «2026-09» из адреса — первое число месяца или null. */
function parseMonth(ym: string | undefined): string | null {
  const iso = `${ym ?? ''}-01`
  return /^\d{4}-\d{2}$/.test(ym ?? '') && isISODate(iso) ? iso : null
}

/** Итоги месяца: цифры против прошлого месяца, календарь, мышцы, упражнения, рекорды. */
export function MonthPage() {
  const { month: ym } = useParams()
  const month = parseMonth(ym)
  if (!month) return <Navigate to="/progress" replace />
  return <MonthReportView key={month} month={month} />
}

function MonthReportView({ month }: { month: string }) {
  const navigate = useNavigate()
  const workouts = useDoneWorkouts()
  const entries = useAllEntries()
  const exercises = useExerciseMap()
  const settings = useSettings()
  const today = todayISO()
  const current = startOfMonth(today) === month
  const [sharing, runShare] = useBusy()

  const report = useMemo(
    () =>
      workouts && entries && exercises
        ? monthReport(month, workouts, entries, exercises, settings.weeklyGoal)
        : undefined,
    [month, workouts, entries, exercises, settings.weeklyGoal],
  )
  const inMonth = useMemo(
    () => (workouts ?? []).filter((w) => startOfMonth(w.date) === month),
    [workouts, month],
  )
  const title = formatMonthYear(month, today)

  const days = useMemo(() => {
    const map = new Map<string, MuscleGroup[]>()
    for (const w of inMonth) {
      map.set(w.date, [...new Set([...(map.get(w.date) ?? []), ...(w.summary?.muscles ?? [])])])
    }
    return map
  }, [inMonth])

  function share() {
    if (!report) return
    void runShare(async () => {
      const file = await monthImage(report, title)
      const res = await shareOrDownload(file)
      if (res === 'downloaded' || res === 'fallback') toast('Картинка сохранена в загрузки')
    })
  }

  const go = (n: number) => {
    void navigate(`/progress/month/${addMonths(month, n).slice(0, 7)}`, { replace: true })
  }

  return (
    <Page
      title={title}
      subtitle={current ? 'Итоги месяца · месяц идёт' : 'Итоги месяца'}
      back="/progress"
      actions={
        report && report.totals.workouts > 0 ? (
          <IconButton label="Поделиться итогами" onClick={share} disabled={sharing}>
            <Share className="size-5" strokeWidth={2.2} />
          </IconButton>
        ) : undefined
      }
    >
      {report === undefined ? null : report.totals.workouts === 0 ? (
        <>
          <EmptyState
            icon={<Trophy />}
            title="В этом месяце тренировок нет"
            message="Итоги появятся после первой завершённой тренировки."
          />
          <Section plain>
            <MonthCalendar
              month={month}
              onMonth={(m) => {
                go(m > month ? 1 : -1)
              }}
              days={days}
              onDay={() => undefined}
            />
          </Section>
        </>
      ) : (
        <>
          <Hero report={report} />
          <Tiles totals={report.totals} previous={report.previous} />
          <GoalLine report={report} goal={settings.weeklyGoal} current={current} />

          <Section plain className="mt-5">
            <MonthCalendar
              month={month}
              onMonth={(m) => {
                go(m > month ? 1 : -1)
              }}
              days={days}
              onDay={(date) => {
                const w = inMonth.find((x) => x.date === date)
                if (w) void navigate(`/history/${w.id}`)
              }}
            />
          </Section>

          <Section header="Группы мышц" footer="Рабочие подходы за месяц">
            <div className="px-4 py-3">
              <HBars
                bars={report.muscles.slice(0, 8).map((m) => ({
                  key: m.muscle,
                  label: MUSCLE_LABEL[m.muscle],
                  value: m.sets,
                  color: muscleColor(m.muscle),
                }))}
                format={(v) => formatNumber(v, 0)}
              />
            </div>
          </Section>

          <TopExercises report={report} exercises={exercises} />
          <MonthRecords workouts={inMonth} exercises={exercises} />
          <BestWorkout report={report} workouts={inMonth} />

          <Section plain>
            <Button
              block
              size="lg"
              variant="tinted"
              icon={<Share className="size-5" />}
              disabled={sharing}
              onClick={share}
            >
              Поделиться картинкой
            </Button>
          </Section>
        </>
      )}
    </Page>
  )
}

/** Главная цифра месяца и сравнение с прошлым. */
function Hero({ report }: { report: MonthReport }) {
  const n = report.totals.workouts
  const before = report.previous.workouts
  const prevName = monthPrepositional(addMonths(report.month, -1))
  const diff = n - before
  const compare =
    before === 0
      ? `в ${prevName} не было ни одной`
      : diff === 0
        ? `столько же, сколько в ${prevName}`
        : `на ${formatNumber(Math.abs(diff), 0)} ${diff > 0 ? 'больше' : 'меньше'}, чем в ${prevName}`
  return (
    <div className="px-5 pt-1">
      <div className="flex items-baseline gap-2">
        <span className="font-rounded text-[3.5rem] leading-none font-bold tabular">{n}</span>
        <span className="text-title-3 font-semibold">
          {plural(n, 'тренировка', 'тренировки', 'тренировок')}
        </span>
      </div>
      <p className={`mt-1 text-subhead ${diff > 0 ? 'text-success' : 'text-label-2'}`}>{compare}</p>
    </div>
  )
}

function Tiles({ totals, previous }: { totals: MonthTotals; previous: MonthTotals }) {
  const tiles = [
    {
      label: 'Время',
      value: totals.seconds > 0 ? formatDuration(totals.seconds) : '—',
      delta: totals.seconds - previous.seconds,
      fmt: (d: number) => formatDuration(d),
    },
    {
      label: 'Объём',
      value: totals.volume > 0 ? formatVolume(totals.volume) : '—',
      delta: totals.volume - previous.volume,
      fmt: (d: number) => formatVolume(d),
    },
    {
      label: 'Подходы',
      value: String(totals.sets),
      delta: totals.sets - previous.sets,
      fmt: (d: number) => formatNumber(d, 0),
    },
    {
      label: 'Рекорды',
      value: String(totals.records),
      delta: totals.records - previous.records,
      fmt: (d: number) => formatNumber(d, 0),
    },
  ]
  return (
    <div className="mx-4 mt-4 grid grid-cols-2 gap-2.5">
      {tiles.map((t) => (
        <div
          key={t.label}
          className="rounded-[var(--radius-card)] bg-surface px-4 py-3 shadow-[var(--shadow-card)]"
        >
          <div className="text-footnote text-label-2">{t.label}</div>
          <div className="mt-0.5 font-rounded text-title-2 font-bold">{t.value}</div>
          <div className={`mt-0.5 text-caption ${t.delta > 0 ? 'text-success' : 'text-label-2'}`}>
            {Math.abs(t.delta) < 0.5
              ? 'как в прошлом месяце'
              : `${t.delta > 0 ? '+' : '−'}${t.fmt(Math.abs(t.delta))} к прошлому`}
          </div>
        </div>
      ))}
    </div>
  )
}

/** Сколько недель выполнена цель «N тренировок в неделю». */
function GoalLine({
  report,
  goal,
  current,
}: {
  report: MonthReport
  goal: number
  current: boolean
}) {
  if (report.weeks === 0) return null
  return (
    <p className="mx-5 mt-3 text-footnote text-label-2">
      Цель «{countLabel(goal, 'тренировка', 'тренировки', 'тренировок')} в неделю» —{' '}
      <span className="font-semibold text-label">
        {report.goalWeeks} из {countLabel(report.weeks, 'недели', 'недель', 'недель')}
      </span>
      {current ? ' (неделя ещё может добавиться)' : ''}
    </p>
  )
}

function TopExercises({
  report,
  exercises,
}: {
  report: MonthReport
  exercises: ReadonlyMap<string, Exercise> | undefined
}) {
  const top = report.exercises.slice(0, 5)
  if (top.length === 0 || !exercises) return null
  return (
    <Section header="Главные упражнения">
      {top.map((x) => {
        const ex = exercises.get(x.exerciseId)
        if (!ex) return null
        return (
          <Link
            key={x.exerciseId}
            to={`/exercises/${encodeURIComponent(x.exerciseId)}`}
            className="flex items-center gap-3 pressable px-4 py-3 [&+&]:hairline-t"
          >
            <MuscleDot muscle={ex.muscle} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-body">{ex.name}</span>
              <span className="block text-footnote text-label-2">
                {countLabel(x.sets, 'подход', 'подхода', 'подходов')}
                {x.topWeight > 0 && ` · до ${formatWeight(x.topWeight)}`}
              </span>
            </span>
            <ChevronRight
              className="size-[1.125rem] shrink-0 text-label-3"
              strokeWidth={2.5}
              aria-hidden
            />
          </Link>
        )
      })}
    </Section>
  )
}

/** Рекорды месяца: по упражнению — что именно побито и когда. */
function MonthRecords({
  workouts,
  exercises,
}: {
  workouts: Workout[]
  exercises: ReadonlyMap<string, Exercise> | undefined
}) {
  const withRecords = workouts.filter((w) => (w.summary?.records ?? 0) > 0)
  const rows = useLiveQuery(async () => {
    const out: { key: string; exerciseId: string; date: string; types: string[] }[] = []
    for (const w of withRecords) {
      const records = await workoutRecords(w.id)
      const byExercise = new Map<string, Set<string>>()
      for (const r of records) {
        const set = byExercise.get(r.exerciseId) ?? new Set()
        for (const t of r.types) set.add(RECORD_LABEL[t].toLowerCase())
        byExercise.set(r.exerciseId, set)
      }
      for (const [exerciseId, types] of byExercise) {
        out.push({ key: `${w.id}-${exerciseId}`, exerciseId, date: w.date, types: [...types] })
      }
    }
    return out
  }, [withRecords.map((w) => w.id).join()])
  if (!rows || rows.length === 0 || !exercises) return null
  return (
    <Section header="Рекорды">
      {rows.slice(0, 8).map((r) => {
        const ex = exercises.get(r.exerciseId)
        if (!ex) return null
        return (
          <div key={r.key} className="flex items-center gap-3 px-4 py-3 [&+&]:hairline-t">
            <Trophy className="size-5 shrink-0 text-warning" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-body">{ex.name}</span>
              <span className="block truncate text-footnote text-label-2">
                {r.types.join(', ')}
              </span>
            </span>
            <span className="shrink-0 text-footnote text-label-2">{formatDayMonth(r.date)}</span>
          </div>
        )
      })}
    </Section>
  )
}

function BestWorkout({ report, workouts }: { report: MonthReport; workouts: Workout[] }) {
  const best = report.best ? workouts.find((w) => w.id === report.best?.workoutId) : undefined
  if (!best || !report.best) return null
  return (
    <Section header="Самая объёмная тренировка">
      <Link to={`/history/${best.id}`} className="flex items-center gap-3 pressable px-4 py-3">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-body">{workoutTitle(best)}</span>
          <span className="block text-footnote text-label-2">
            {formatDayMonth(best.date)} · {formatVolume(report.best.volume)}
          </span>
        </span>
        <ChevronRight
          className="size-[1.125rem] shrink-0 text-label-3"
          strokeWidth={2.5}
          aria-hidden
        />
      </Link>
    </Section>
  )
}
