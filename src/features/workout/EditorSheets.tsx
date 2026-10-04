import clsx from 'clsx'
import { Check, GripVertical } from 'lucide-react'
import { Reorder, useDragControls } from 'motion/react'
import { useState } from 'react'
import { useExerciseHistory } from '@/db/hooks'
import { formatClock } from '@/domain/format'
import { formatRelativeDay } from '@/domain/dates'
import type { Exercise, WorkoutEntry } from '@/domain/types'
import { MuscleDot } from '@/ui/MuscleDot'
import { Sheet } from '@/ui/Sheet'
import { formatHint } from './format'

/** Комментарий к упражнению в этой тренировке. */
export function NoteSheet({
  open,
  initial,
  title,
  onClose,
  onSave,
}: {
  open: boolean
  initial: string
  title: string
  onClose: () => void
  onSave: (note: string) => void
}) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <NoteForm initial={initial} onClose={onClose} onSave={onSave} />
    </Sheet>
  )
}

function NoteForm({
  initial,
  onClose,
  onSave,
}: {
  initial: string
  onClose: () => void
  onSave: (note: string) => void
}) {
  const [text, setText] = useState(initial)
  return (
    <div className="space-y-3 px-4 pb-5">
      <textarea
        autoFocus
        value={text}
        onChange={(e) => {
          setText(e.target.value)
        }}
        rows={4}
        placeholder="Ощущения, техника, страховка…"
        className="w-full resize-none rounded-[var(--radius-cell)] bg-fill-3 px-4 py-3 text-body outline-none placeholder:text-label-3"
      />
      <button
        type="button"
        onClick={() => {
          onSave(text)
          onClose()
        }}
        className="h-12 w-full press-scale rounded-full bg-accent text-body font-semibold text-on-accent"
      >
        Сохранить
      </button>
    </div>
  )
}

const REST_OPTIONS = [30, 45, 60, 90, 120, 150, 180, 240, 300]

/** Отдых между подходами для упражнения. */
export function RestSheet({
  open,
  value,
  onClose,
  onPick,
}: {
  open: boolean
  value: number
  onClose: () => void
  onPick: (sec: number, remember: boolean) => void
}) {
  const [remember, setRemember] = useState(true)
  return (
    <Sheet open={open} onClose={onClose} title="Отдых между подходами">
      <div className="px-4 pb-5">
        <div className="grid grid-cols-3 gap-2">
          {REST_OPTIONS.map((sec) => (
            <button
              key={sec}
              type="button"
              onClick={() => {
                onPick(sec, remember)
                onClose()
              }}
              className={clsx(
                'h-12 press-scale rounded-[var(--radius-cell)] font-rounded text-body font-semibold tabular',
                sec === value ? 'bg-accent text-on-accent' : 'bg-fill-3',
              )}
            >
              {formatClock(sec)}
            </button>
          ))}
        </div>
        <label className="mt-4 flex items-center gap-3 px-1 text-subhead text-label-2">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => {
              setRemember(e.target.checked)
            }}
            className="size-5 accent-[var(--accent)]"
          />
          Запомнить для этого упражнения
        </label>
      </div>
    </Sheet>
  )
}

/** Порядок упражнений: перетаскивание за ручку. */
export function ReorderSheet({
  open,
  entries,
  exercises,
  onClose,
  onSave,
}: {
  open: boolean
  entries: readonly WorkoutEntry[]
  exercises: ReadonlyMap<string, Exercise>
  onClose: () => void
  onSave: (ids: string[]) => void
}) {
  return (
    <Sheet open={open} onClose={onClose} title="Порядок упражнений">
      <ReorderList entries={entries} exercises={exercises} onClose={onClose} onSave={onSave} />
    </Sheet>
  )
}

function ReorderList({
  entries,
  exercises,
  onClose,
  onSave,
}: {
  entries: readonly WorkoutEntry[]
  exercises: ReadonlyMap<string, Exercise>
  onClose: () => void
  onSave: (ids: string[]) => void
}) {
  const [order, setOrder] = useState(() => entries.map((e) => e.id))
  const byId = new Map(entries.map((e) => [e.id, e]))
  return (
    <div className="px-4 pb-5">
      <Reorder.Group axis="y" values={order} onReorder={setOrder} className="space-y-2">
        {order.map((id) => {
          const e = byId.get(id)
          const ex = e ? exercises.get(e.exerciseId) : undefined
          if (!e || !ex) return null
          return <ReorderRow key={id} id={id} exercise={ex} sets={e.sets.length} />
        })}
      </Reorder.Group>
      <button
        type="button"
        onClick={() => {
          onSave(order)
          onClose()
        }}
        className="mt-4 flex h-12 w-full press-scale items-center justify-center gap-2 rounded-full bg-accent text-body font-semibold text-on-accent"
      >
        <Check className="size-5" strokeWidth={2.6} /> Готово
      </button>
    </div>
  )
}

function ReorderRow({ id, exercise, sets }: { id: string; exercise: Exercise; sets: number }) {
  const controls = useDragControls()
  return (
    <Reorder.Item
      value={id}
      dragListener={false}
      dragControls={controls}
      className="flex items-center gap-3 rounded-[var(--radius-cell)] bg-fill-3 py-3 pr-2 pl-4"
      whileDrag={{ scale: 1.03, boxShadow: '0 10px 30px rgb(0 0 0 / 0.18)' }}
    >
      <MuscleDot muscle={exercise.muscle} size={10} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-body">{exercise.name}</span>
        <span className="block text-footnote text-label-2">{sets} подх.</span>
      </span>
      <span
        className="flex size-10 touch-none items-center justify-center text-label-3"
        onPointerDown={(e) => {
          controls.start(e)
        }}
        aria-label="Перетащить"
      >
        <GripVertical className="size-5" />
      </span>
    </Reorder.Item>
  )
}

/** Последние тренировки с упражнением — не уходя с экрана тренировки. */
export function ExerciseHistorySheet({
  exercise,
  onClose,
}: {
  exercise: Exercise | null
  onClose: () => void
}) {
  return (
    <Sheet open={exercise !== null} onClose={onClose} title={exercise?.name ?? ''}>
      {exercise && <HistoryList exercise={exercise} />}
    </Sheet>
  )
}

function HistoryList({ exercise }: { exercise: Exercise }) {
  const history = useExerciseHistory(exercise.id)
  if (!history) return <div className="h-40" />
  if (history.length === 0) {
    return (
      <p className="px-6 pt-4 pb-10 text-center text-subhead text-label-2">
        Это упражнение ещё не делали.
      </p>
    )
  }
  return (
    <div className="space-y-2 px-4 pb-6">
      {history.slice(0, 12).map((h) => (
        <div key={h.workout.id} className="rounded-[var(--radius-cell)] bg-fill-3 px-4 py-3">
          <div className="text-footnote font-semibold text-label-2">
            {formatRelativeDay(h.workout.date)}
          </div>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 font-rounded text-subhead tabular">
            {h.sets.map((s) => (
              <span key={s.id} className={s.type === 'warmup' ? 'text-label-2' : undefined}>
                {formatHint(exercise.kind, s)}
              </span>
            ))}
          </div>
          {h.note && <p className="mt-1 text-footnote text-label-2">{h.note}</p>}
        </div>
      ))}
    </div>
  )
}
