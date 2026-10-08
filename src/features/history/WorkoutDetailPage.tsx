import { useLiveQuery } from 'dexie-react-hooks'
import { BookmarkPlus, PencilLine, RotateCcw, Share, Trash2, Trophy } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router'
import { useActiveWorkout, useEntries, useExerciseMap, useWorkout } from '@/db/hooks'
import { templateFromWorkout } from '@/db/templates'
import { deleteWorkout, restoreWorkout, workoutRecords } from '@/db/workouts'
import { formatDayMonth, formatTime, formatWeekdayDayMonth, todayISO } from '@/domain/dates'
import { capitalize, formatDuration, formatVolume, volumeParts } from '@/domain/format'
import { SET_TYPE_BADGE } from '@/domain/labels'
import { isWorking } from '@/domain/sets'
import { workoutSeconds } from '@/domain/stats'
import type { Exercise, Workout, WorkoutEntry } from '@/domain/types'
import { useBusy } from '@/lib/useBusy'
import { ActionSheet } from '@/ui/ActionSheet'
import { Row, Section } from '@/ui/List'
import { MuscleDot } from '@/ui/MuscleDot'
import { Page } from '@/ui/Page'
import { toast } from '@/ui/Toast'
import { begin } from '../today/StartSheet'
import { formatHint } from '../workout/format'
import { ratingOf } from '../workout/ratings'
import { workoutUi } from '../workout/store'
import { workoutTitle } from './WorkoutRow'

export function WorkoutDetailPage() {
  const { id } = useParams()
  const workout = useWorkout(id)
  const entries = useEntries(id)
  const exercises = useExerciseMap()
  const active = useActiveWorkout()
  const records = useLiveQuery(() => (id ? workoutRecords(id) : []), [id, workout?.updatedAt])
  const navigate = useNavigate()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [saving, runSave] = useBusy()
  const isActive = workout?.status === 'active'

  // Идущая тренировка открывается на своём экране, а не в истории.
  useEffect(() => {
    if (isActive) {
      workoutUi.open()
      void navigate('/', { replace: true })
    }
  }, [isActive, navigate])

  if (workout === null) return <Navigate to="/history" replace />
  if (!workout || !entries || !exercises || isActive)
    return (
      <Page title="Тренировка" back inline>
        {null}
      </Page>
    )

  const recordSets = new Set((records ?? []).map((r) => r.setId))
  const s = workout.summary
  const seconds = workoutSeconds(workout)
  const rating = ratingOf(workout.rating)
  const title = workoutTitle(workout)

  async function remove() {
    if (!workout) return
    const deleted = await deleteWorkout(workout.id)
    void navigate('/history', { replace: true })
    if (deleted)
      toast('Тренировка удалена', {
        label: 'Вернуть',
        onAction: () => void restoreWorkout(deleted),
      })
  }

  async function share() {
    if (!workout || !entries || !exercises) return
    const text = shareText(workout, entries, exercises, recordSets)
    try {
      if (typeof navigator.share === 'function') await navigator.share({ text })
      else {
        await navigator.clipboard.writeText(text)
        toast('Скопировано')
      }
    } catch {
      // отмена — не ошибка
    }
  }

  return (
    <Page title={formatDayMonth(workout.date)} back inline>
      <div className="px-5 pt-2">
        <h1 className="text-title-1 font-bold">{title}</h1>
        <p className="mt-1 text-subhead text-label-2">
          {capitalize(formatWeekdayDayMonth(workout.date, todayISO()))}
          {seconds > 0 && ` · ${formatTime(workout.startedAt)}`}
          {rating && ` · ${rating.emoji} ${rating.label.toLowerCase()}`}
        </p>
      </div>

      <div className="mx-4 mt-4 grid grid-cols-4 gap-2">
        <Stat label="Время" value={seconds > 0 ? formatDuration(seconds) : '—'} />
        <Stat
          label={`Объём, ${volumeParts(s?.volume ?? 0).unit}`}
          value={s && s.volume > 0 ? volumeParts(s.volume).value : '—'}
        />
        <Stat label="Подходы" value={String(s?.sets ?? 0)} />
        <Stat label="Рекорды" value={String(s?.records ?? 0)} accent={(s?.records ?? 0) > 0} />
      </div>

      {workout.note && (
        <Section header="Заметка">
          <p className="px-4 py-3 text-body whitespace-pre-wrap">{workout.note}</p>
        </Section>
      )}

      <div className="mt-6 space-y-3 px-4">
        {entries.map((e) => {
          const ex = exercises.get(e.exerciseId)
          if (!ex) return null
          return <EntryView key={e.id} entry={e} exercise={ex} records={recordSets} />
        })}
        {entries.length === 0 && (
          <p className="py-6 text-center text-subhead text-label-2">
            Упражнений нет — добавь их в правке.
          </p>
        )}
      </div>

      <Section>
        <Row icon={<PencilLine />} title="Изменить" chevron to={`/history/${workout.id}/edit`} />
        <Row
          icon={<RotateCcw />}
          iconBg="var(--success)"
          title={active ? 'Повторить (сначала заверши текущую)' : 'Повторить тренировку'}
          disabled={Boolean(active)}
          onClick={() => void begin({ repeatOf: workout.id })}
        />
        <Row
          icon={<BookmarkPlus />}
          iconBg="var(--m-back)"
          title="Сохранить как программу"
          disabled={saving}
          onClick={() =>
            void runSave(async () => {
              await templateFromWorkout(workout.id, title)
              toast('Сохранено в программы')
            })
          }
        />
        <Row
          icon={<Share />}
          iconBg="var(--m-chest)"
          title="Поделиться"
          onClick={() => void share()}
        />
      </Section>
      <Section>
        <Row
          title="Удалить тренировку"
          destructive
          trailing={<Trash2 className="size-5 text-danger" />}
          onClick={() => {
            setConfirmDelete(true)
          }}
        />
      </Section>

      <ActionSheet
        open={confirmDelete}
        onClose={() => {
          setConfirmDelete(false)
        }}
        title="Удалить тренировку?"
        message="Её можно будет вернуть сразу после удаления."
        actions={[{ label: 'Удалить', destructive: true, onSelect: () => void remove() }]}
      />
    </Page>
  )
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  // «1 ч 25 мин» в узкую плитку не влезает: переносится по «1 ч / 25 мин», а не обрезается.
  return (
    <div className="rounded-[var(--radius-cell)] bg-surface px-2 py-2.5 text-center">
      <div
        className={`font-rounded text-body leading-tight font-bold text-balance ${accent ? 'text-warning' : ''}`}
      >
        {value.replace(/ (мин|сек|кг|т)$/u, '\u00a0$1')}
      </div>
      <div className="mt-0.5 text-caption-2 text-label-2">{label}</div>
    </div>
  )
}

function EntryView({
  entry,
  exercise,
  records,
}: {
  entry: WorkoutEntry
  exercise: Exercise
  records: Set<string>
}) {
  let n = 0
  return (
    <article className="overflow-hidden rounded-[var(--radius-card)] bg-surface">
      <header className="flex items-center gap-2 px-4 pt-3.5 pb-1.5">
        <MuscleDot muscle={exercise.muscle} size={10} />
        <h3 className="min-w-0 flex-1 truncate text-body font-semibold">{exercise.name}</h3>
      </header>
      {entry.note && <p className="px-4 pb-1.5 text-footnote text-label-2 italic">{entry.note}</p>}
      <ol className="px-4 pb-3">
        {entry.sets.map((s) => {
          const num = isWorking(s) ? ++n : 0
          const badge = SET_TYPE_BADGE[s.type] || String(num)
          return (
            <li key={s.id} className="flex items-center gap-3 py-1 font-rounded text-body tabular">
              <span className="w-5 text-center text-subhead text-label-2">{badge}</span>
              <span className={isWorking(s) ? '' : 'text-label-2'}>
                {formatHint(exercise.kind, s)}
              </span>
              {records.has(s.id) && <Trophy className="size-4 text-warning" aria-label="Рекорд" />}
            </li>
          )
        })}
      </ol>
    </article>
  )
}

function shareText(
  w: Workout,
  entries: WorkoutEntry[],
  exercises: ReadonlyMap<string, Exercise>,
  records: Set<string>,
): string {
  const seconds = workoutSeconds(w)
  const head = [
    workoutTitle(w),
    formatDayMonth(w.date),
    seconds > 0 ? formatDuration(seconds) : null,
  ]
    .filter(Boolean)
    .join(' · ')
  const lines = entries.flatMap((e) => {
    const ex = exercises.get(e.exerciseId)
    if (!ex) return []
    const sets = e.sets
      .filter((s) => s.done)
      .map((s) => `${formatHint(ex.kind, s)}${records.has(s.id) ? ' 🏆' : ''}`)
    return sets.length > 0 ? [`${ex.name}: ${sets.join(', ')}`] : []
  })
  const volume =
    w.summary && w.summary.volume > 0 ? [`Объём: ${formatVolume(w.summary.volume)}`] : []
  return [head, '', ...lines, ...(volume.length > 0 ? ['', ...volume] : [])].join('\n')
}
