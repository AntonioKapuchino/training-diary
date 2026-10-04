import { Archive, ArchiveRestore, Ellipsis, Merge, PencilLine, Trash2, Trophy } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router'
import { deleteExercise, exerciseUsage, mergeExercises, setArchived } from '@/db/exercises'
import { useExercise, useExerciseHistory, useExerciseMap } from '@/db/hooks'
import {
  addDays,
  dateOf,
  formatDayMonth,
  formatDayMonthShort,
  formatRelativeDay,
  todayISO,
} from '@/domain/dates'
import {
  formatClock,
  formatDistance,
  formatDuration,
  formatNumber,
  formatPace,
  formatVolume,
  formatWeight,
} from '@/domain/format'
import { EQUIPMENT_LABEL, KIND_LABEL, MUSCLE_LABEL, muscleColor } from '@/domain/labels'
import { repMaxes } from '@/domain/records'
import { METRICS, sessionPoint, type MetricKey, type SessionPoint } from '@/domain/stats'
import type { Exercise, ExerciseKind } from '@/domain/types'
import { ActionSheet, type Action } from '@/ui/ActionSheet'
import { IconButton } from '@/ui/Button'
import { LineChart } from '@/ui/charts/LineChart'
import { EmptyState } from '@/ui/EmptyState'
import { Section } from '@/ui/List'
import { MuscleDot } from '@/ui/MuscleDot'
import { Page } from '@/ui/Page'
import { Segmented } from '@/ui/Segmented'
import { toast } from '@/ui/Toast'
import { formatHint } from '../workout/format'
import { ExerciseFormSheet } from './ExerciseFormSheet'
import { ExercisePicker } from './ExercisePicker'

type Period = '3m' | '6m' | '1y' | 'all'
const PERIODS: { value: Period; label: string }[] = [
  { value: '3m', label: '3 мес' },
  { value: '6m', label: '6 мес' },
  { value: '1y', label: 'Год' },
  { value: 'all', label: 'Всё' },
]
const PERIOD_DAYS: Record<Period, number> = { '3m': 92, '6m': 183, '1y': 366, all: Infinity }

export function formatMetric(key: MetricKey, v: number): string {
  switch (key) {
    case 'e1rm':
    case 'weight':
      return formatWeight(Math.round(v * 10) / 10)
    case 'volume':
      return formatVolume(v)
    case 'reps':
    case 'totalReps':
      return `${formatNumber(v, 0)} повт.`
    case 'duration':
    case 'totalDuration':
      return v >= 3600 ? formatDuration(v) : formatClock(v)
    case 'distance':
      return formatDistance(v)
    case 'pace':
      return formatPace(v)
  }
}

/** Короткая подпись на оси: без единиц, они в заголовке. */
function axisValue(key: MetricKey, v: number): string {
  if (key === 'duration' || key === 'totalDuration' || key === 'pace') return formatClock(v)
  if (key === 'volume' && v >= 10_000) return `${formatNumber(v / 1000, 1)}т`
  return formatNumber(v, 1)
}

export function ExerciseDetailPage() {
  const { id } = useParams()
  const exercise = useExercise(id)
  if (exercise === null) return <Navigate to="/exercises" replace />
  if (!exercise)
    return (
      <Page title="Упражнение" back inline>
        {null}
      </Page>
    )
  return <Detail exercise={exercise} />
}

function Detail({ exercise }: { exercise: Exercise }) {
  const history = useExerciseHistory(exercise.id)
  const exercises = useExerciseMap()
  const navigate = useNavigate()
  const metrics = METRICS[exercise.kind]
  const [metric, setMetric] = useState<MetricKey>(metrics[0]?.key ?? 'weight')
  const [period, setPeriod] = useState<Period>('all')
  const [menu, setMenu] = useState(false)
  const [editing, setEditing] = useState(false)
  const [merging, setMerging] = useState(false)
  const [mergeTarget, setMergeTarget] = useState<Exercise | null>(null)
  const [kindLocked, setKindLocked] = useState(true)

  const points = useMemo(
    () =>
      (history ?? [])
        .map((h) => sessionPoint(exercise.kind, h.workout.id, h.workout.startedAt, h.sets))
        .filter((p): p is SessionPoint => p !== null)
        .reverse(),
    [history, exercise.kind],
  )
  const since = period === 'all' ? '' : addDays(todayISO(), -PERIOD_DAYS[period])
  const shown = points.filter((p) => p.date >= since)
  const def = metrics.find((m) => m.key === metric) ?? metrics[0]
  const series = shown.map((p) => ({ x: p.startedAt, y: p[metric] })).filter((p) => p.y > 0)
  const allSets = useMemo(() => (history ?? []).flatMap((h) => h.sets), [history])

  async function openEdit() {
    const usage = await exerciseUsage(exercise.id)
    setKindLocked(usage.sessions > 0)
    setEditing(true)
  }

  async function remove() {
    if (await deleteExercise(exercise.id)) {
      toast(`«${exercise.name}» удалено`)
      void navigate('/exercises', { replace: true })
    } else {
      await setArchived(exercise.id, true)
      toast('Есть история — упражнение убрано в архив')
    }
  }

  const actions: Action[] = [
    { label: 'Изменить', icon: <PencilLine className="size-5" />, onSelect: () => void openEdit() },
    {
      label: 'Объединить с другим',
      icon: <Merge className="size-5" />,
      onSelect: () => {
        setMerging(true)
      },
    },
    exercise.archivedAt
      ? {
          label: 'Вернуть из архива',
          icon: <ArchiveRestore className="size-5" />,
          onSelect: () => void setArchived(exercise.id, false),
        }
      : {
          label: 'В архив',
          icon: <Archive className="size-5" />,
          onSelect: () => void setArchived(exercise.id, true),
        },
    ...(exercise.custom
      ? [
          {
            label: 'Удалить',
            icon: <Trash2 className="size-5" />,
            destructive: true,
            onSelect: () => void remove(),
          },
        ]
      : []),
  ]

  return (
    <Page
      title={exercise.name}
      back
      actions={
        <IconButton
          label="Действия"
          onClick={() => {
            setMenu(true)
          }}
        >
          <Ellipsis className="size-5" strokeWidth={2.4} />
        </IconButton>
      }
      subtitle={
        <span className="inline-flex items-center gap-1.5">
          <MuscleDot muscle={exercise.muscle} />
          {MUSCLE_LABEL[exercise.muscle]} · {EQUIPMENT_LABEL[exercise.equipment]} ·{' '}
          {KIND_LABEL[exercise.kind]}
          {exercise.archivedAt ? ' · в архиве' : ''}
        </span>
      }
    >
      {exercise.note && (
        <p className="mx-5 mb-1 text-subhead text-label-2 italic">{exercise.note}</p>
      )}

      {history?.length === 0 ? (
        <EmptyState
          icon={<Trophy />}
          title="Ещё не делали"
          message="Добавь упражнение в тренировку — здесь появятся график, рекорды и история."
        />
      ) : (
        <>
          <Bests kind={exercise.kind} points={points} />

          <Section plain className="mt-5">
            <div className="rounded-[var(--radius-card)] bg-surface p-4 shadow-[var(--shadow-card)]">
              <Segmented
                label="Показатель"
                value={metric}
                options={metrics.map((m) => ({ value: m.key, label: m.label }))}
                onChange={setMetric}
              />
              <div className="mt-4 mb-1 flex items-baseline justify-between gap-3">
                <div>
                  <div className="text-footnote text-label-2">{def?.label}</div>
                  <div className="font-rounded text-title-2 font-bold">
                    {series.length > 0 ? formatMetric(metric, series.at(-1)?.y ?? 0) : '—'}
                  </div>
                </div>
                {series.length > 1 && (
                  <Delta
                    first={series[0]?.y ?? 0}
                    last={series.at(-1)?.y ?? 0}
                    metric={metric}
                    lowerIsBetter={def?.lowerIsBetter}
                  />
                )}
              </div>
              {series.length >= 2 ? (
                <LineChart
                  points={series}
                  color={muscleColor(exercise.muscle)}
                  formatY={(v) => axisValue(metric, v)}
                  formatX={(x) => formatDayMonth(dateOf(x))}
                  axisX={(x) => formatDayMonthShort(dateOf(x))}
                  label={`${def?.label ?? ''}: от ${formatMetric(metric, series[0]?.y ?? 0)} до ${formatMetric(metric, series.at(-1)?.y ?? 0)}`}
                />
              ) : (
                <p className="py-12 text-center text-subhead text-label-2">
                  {points.length < 2
                    ? 'График появится после второй тренировки'
                    : 'За этот период мало данных'}
                </p>
              )}
              <Segmented
                label="Период"
                className="mt-3"
                value={period}
                options={PERIODS}
                onChange={setPeriod}
              />
            </div>
          </Section>

          {exercise.kind === 'strength' && <RepMaxes sets={allSets} />}

          <Section header="История">
            {(history ?? []).slice(0, 30).map((h) => (
              <Link
                key={h.workout.id}
                to={`/history/${h.workout.id}`}
                className="block pressable px-4 py-3 [&+&]:hairline-t"
              >
                <div className="text-footnote font-semibold text-label-2">
                  {formatRelativeDay(h.workout.date)}
                </div>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 font-rounded text-subhead tabular">
                  {h.sets.map((s) => (
                    <span key={s.id} className={s.type === 'warmup' ? 'text-label-2' : undefined}>
                      {formatHint(exercise.kind, s)}
                    </span>
                  ))}
                </div>
                {h.note && <div className="mt-0.5 text-footnote text-label-2">{h.note}</div>}
              </Link>
            ))}
          </Section>
        </>
      )}

      <ActionSheet
        open={menu}
        onClose={() => {
          setMenu(false)
        }}
        title={exercise.name}
        actions={actions}
      />
      <ExerciseFormSheet
        open={editing}
        exercise={exercise}
        kindLocked={kindLocked}
        onClose={() => {
          setEditing(false)
        }}
      />
      <ExercisePicker
        open={merging}
        multiple={false}
        title="С каким объединить"
        onClose={() => {
          setMerging(false)
        }}
        onPick={([target]) => {
          const t = target ? exercises?.get(target) : undefined
          if (!t || t.id === exercise.id) return
          if (t.kind !== exercise.kind) {
            toast('Объединить можно только упражнения с одинаковым способом учёта')
            return
          }
          setMergeTarget(t)
        }}
      />
      <ActionSheet
        open={mergeTarget !== null}
        onClose={() => {
          setMergeTarget(null)
        }}
        title={`Перенести историю в «${mergeTarget?.name ?? ''}»?`}
        message={`Все подходы «${exercise.name}» станут подходами «${mergeTarget?.name ?? ''}», а «${exercise.name}» ${exercise.custom ? 'удалится' : 'уйдёт в архив'}.`}
        actions={[
          {
            label: 'Объединить',
            destructive: true,
            onSelect: () => {
              const target = mergeTarget
              if (!target) return
              void mergeExercises(exercise.id, target.id).then(() => {
                toast('Упражнения объединены')
                void navigate(`/exercises/${target.id}`, { replace: true })
              })
            },
          },
        ]}
      />
    </Page>
  )
}

function Delta({
  first,
  last,
  metric,
  lowerIsBetter,
}: {
  first: number
  last: number
  metric: MetricKey
  lowerIsBetter: boolean | undefined
}) {
  const diff = last - first
  if (Math.abs(diff) < 1e-9)
    return <span className="text-footnote text-label-2">без изменений</span>
  const good = lowerIsBetter ? diff < 0 : diff > 0
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-footnote font-semibold ${good ? 'bg-success-soft text-success' : 'bg-fill-3 text-label-2'}`}
    >
      {diff > 0 ? '+' : '−'}
      {formatMetric(metric, Math.abs(diff))} за период
    </span>
  )
}

/** Плитки лучших значений по способу учёта. */
function Bests({ kind, points }: { kind: ExerciseKind; points: SessionPoint[] }) {
  const max = (k: MetricKey) => points.reduce((m, p) => Math.max(m, p[k]), 0)
  const minPace = points.reduce((m, p) => (p.pace > 0 && (m === 0 || p.pace < m) ? p.pace : m), 0)
  const tiles: { label: string; value: string }[] =
    kind === 'strength'
      ? [
          {
            label: 'Расчётный максимум',
            value: max('e1rm') > 0 ? formatWeight(Math.round(max('e1rm') * 10) / 10) : '—',
          },
          { label: 'Макс. вес', value: max('weight') > 0 ? formatWeight(max('weight')) : '—' },
          { label: 'Тренировок', value: String(points.length) },
        ]
      : kind === 'bodyweight'
        ? [
            { label: 'Повторов за подход', value: String(max('reps')) },
            { label: 'Отягощение', value: max('weight') > 0 ? formatWeight(max('weight')) : '—' },
            { label: 'Тренировок', value: String(points.length) },
          ]
        : kind === 'timed'
          ? [
              { label: 'Лучшее время', value: formatClock(max('duration')) },
              { label: 'Всего за раз', value: formatClock(max('totalDuration')) },
              { label: 'Тренировок', value: String(points.length) },
            ]
          : [
              {
                label: 'Дистанция',
                value: max('distance') > 0 ? formatDistance(max('distance')) : '—',
              },
              { label: 'Лучший темп', value: minPace > 0 ? formatPace(minPace) : '—' },
              { label: 'Тренировок', value: String(points.length) },
            ]
  return (
    <div className="mx-4 mt-3 grid grid-cols-3 gap-2">
      {tiles.map((t) => (
        <div
          key={t.label}
          className="rounded-[var(--radius-cell)] bg-surface px-3 py-3 shadow-[var(--shadow-card)]"
        >
          <div className="truncate font-rounded text-body font-bold">{t.value}</div>
          <div className="mt-0.5 text-caption-2 leading-tight text-label-2">{t.label}</div>
        </div>
      ))}
    </div>
  )
}

/** Лучший вес на 1, 2, 3, 5, 8 и 10 повторов. */
function RepMaxes({ sets }: { sets: Parameters<typeof repMaxes>[0] }) {
  const rm = repMaxes(sets, 10)
  const shown = [1, 2, 3, 5, 8, 10].filter((n) => rm[n - 1] !== undefined)
  if (shown.length === 0) return null
  return (
    <Section
      header="Лучший вес на N повторов"
      footer="Сколько поднимал хотя бы столько раз — по всей истории"
    >
      <div className="grid grid-cols-3">
        {shown.map((n, i) => (
          <div
            key={n}
            className={`px-4 py-3 ${i % 3 !== 0 ? 'shadow-[inset_0.5px_0_0_var(--separator)]' : ''} ${i >= 3 ? 'hairline-t' : ''}`}
          >
            <div className="text-caption text-label-2">{n} повт.</div>
            <div className="font-rounded text-body font-semibold tabular">
              {formatWeight(rm[n - 1] ?? 0)}
            </div>
          </div>
        ))}
      </div>
    </Section>
  )
}
