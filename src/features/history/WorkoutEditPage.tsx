import clsx from 'clsx'
import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router'
import { useWorkout } from '@/db/hooks'
import { deleteWorkout, flushRecompute, restoreWorkout, updateWorkout } from '@/db/workouts'
import { combineDateTime, isISODate, toTimeInput, todayISO } from '@/domain/dates'
import type { Workout } from '@/domain/types'
import { haptic } from '@/lib/haptics'
import { useDebouncedSave } from '@/lib/useDebouncedSave'
import { ActionSheet } from '@/ui/ActionSheet'
import { Button } from '@/ui/Button'
import { Row, Section } from '@/ui/List'
import { Page } from '@/ui/Page'
import { Stepper } from '@/ui/Stepper'
import { toast } from '@/ui/Toast'
import { RATINGS } from '../workout/ratings'
import { workoutUi } from '../workout/store'
import { WorkoutEditor } from '../workout/WorkoutEditor'

/** Правка завершённой или внесённой задним числом тренировки. */
export function WorkoutEditPage() {
  const { id } = useParams()
  const workout = useWorkout(id)
  const navigate = useNavigate()
  const isActive = workout?.status === 'active'

  useEffect(() => {
    if (isActive) {
      workoutUi.open()
      void navigate('/', { replace: true })
    }
  }, [isActive, navigate])

  // Уходя, сразу пересчитываем итоги и рекорды.
  useEffect(
    () => () => {
      workoutUi.closeKeypad()
      void flushRecompute()
    },
    [],
  )

  if (workout === null) return <Navigate to="/history" replace />
  if (!workout || isActive)
    return (
      <Page title="Правка" back inline>
        {null}
      </Page>
    )
  return <Editor workout={workout} />
}

function Editor({ workout }: { workout: Workout }) {
  const navigate = useNavigate()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const title = useDebouncedSave((v) => void updateWorkout(workout.id, { title: v }))
  const note = useDebouncedSave((v) => void updateWorkout(workout.id, { note: v }))
  const minutes = Math.max(
    0,
    Math.round(((workout.finishedAt ?? workout.startedAt) - workout.startedAt) / 60_000),
  )

  async function remove() {
    const deleted = await deleteWorkout(workout.id)
    void navigate('/history', { replace: true })
    if (deleted)
      toast('Тренировка удалена', {
        label: 'Вернуть',
        onAction: () => void restoreWorkout(deleted),
      })
  }

  return (
    <Page
      title="Правка тренировки"
      back
      inline
      tabbar={false}
      actions={
        <Button
          size="sm"
          className="h-9 px-4"
          onClick={() => {
            title.flush()
            note.flush()
            void navigate(-1)
          }}
        >
          Готово
        </Button>
      }
    >
      <Section header="Тренировка">
        <label className="flex min-h-11 items-center gap-3 px-4">
          <span className="w-28 shrink-0 text-body">Название</span>
          <input
            defaultValue={workout.title ?? ''}
            onChange={(e) => {
              title.change(e.target.value)
            }}
            onBlur={title.flush}
            placeholder="По группам мышц"
            className="min-w-0 flex-1 bg-transparent py-2.5 text-right text-body outline-none placeholder:text-label-3"
          />
        </label>
        <label className="flex min-h-11 items-center gap-3 px-4 hairline-t">
          <span className="w-28 shrink-0 text-body">Дата</span>
          <input
            type="date"
            value={workout.date}
            max={todayISO()}
            onChange={(e) => {
              const d = e.target.value
              if (isISODate(d)) void updateWorkout(workout.id, { date: d })
            }}
            className="min-w-0 flex-1 bg-transparent py-2.5 text-right text-body text-accent outline-none"
          />
        </label>
        <label className="flex min-h-11 items-center gap-3 px-4 hairline-t">
          <span className="w-28 shrink-0 text-body">Начало</span>
          <input
            type="time"
            value={toTimeInput(workout.startedAt)}
            onChange={(e) => {
              if (/^\d{2}:\d{2}$/.test(e.target.value)) {
                void updateWorkout(workout.id, {
                  startedAt: combineDateTime(workout.date, e.target.value),
                })
              }
            }}
            className="min-w-0 flex-1 bg-transparent py-2.5 text-right text-body text-accent outline-none"
          />
        </label>
        <Row
          title="Длительность"
          trailing={
            <Stepper
              value={minutes}
              min={0}
              max={300}
              step={5}
              label="Длительность"
              format={(v) => (v === 0 ? '—' : `${v} мин`)}
              onChange={(v) =>
                void updateWorkout(workout.id, { finishedAt: workout.startedAt + v * 60_000 })
              }
            />
          }
        />
      </Section>

      <Section header="Самочувствие">
        <div className="grid grid-cols-5 gap-2 p-2">
          {RATINGS.map((r) => (
            <button
              key={r.value}
              type="button"
              aria-label={r.label}
              aria-pressed={workout.rating === r.value}
              onClick={() => {
                haptic()
                void updateWorkout(workout.id, {
                  rating: workout.rating === r.value ? null : r.value,
                })
              }}
              className={clsx(
                'flex h-12 press-scale items-center justify-center rounded-[var(--radius-cell)] text-[1.5rem]',
                workout.rating === r.value
                  ? 'bg-accent-soft shadow-[inset_0_0_0_2px_var(--accent)]'
                  : 'bg-fill-3',
              )}
            >
              {r.emoji}
            </button>
          ))}
        </div>
      </Section>

      <h3 className="mx-8 mt-7 mb-1.5 text-footnote text-label-2">Упражнения</h3>
      <WorkoutEditor workout={workout} mode="past" />

      <Section header="Заметка">
        <textarea
          defaultValue={workout.note ?? ''}
          onChange={(e) => {
            note.change(e.target.value)
          }}
          onBlur={note.flush}
          rows={3}
          placeholder="Самочувствие, сон, что получилось…"
          className="block w-full resize-none bg-transparent px-4 py-3 text-body outline-none placeholder:text-label-3"
        />
      </Section>

      <Section>
        <Row
          title="Удалить тренировку"
          destructive
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
        actions={[{ label: 'Удалить', destructive: true, onSelect: () => void remove() }]}
      />
    </Page>
  )
}
