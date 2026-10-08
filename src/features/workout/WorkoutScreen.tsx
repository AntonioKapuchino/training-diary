import { ChevronDown, PencilLine, Trash2 } from 'lucide-react'
import { AnimatePresence, motion, useDragControls } from 'motion/react'
import { useMemo, useState } from 'react'
import { useEntries, useExerciseMap } from '@/db/hooks'
import {
  discardWorkout,
  finishStats,
  finishWorkout,
  updateWorkout,
  type FinishStats,
} from '@/db/workouts'
import { countLabel, formatClock, formatVolume } from '@/domain/format'
import { summarize } from '@/domain/stats'
import type { Workout } from '@/domain/types'
import { useDebouncedSave } from '@/lib/useDebouncedSave'
import { useNow } from '@/lib/useNow'
import { useWakeLock } from '@/lib/wakeLock'
import { useSettings } from '@/settings/settings'
import { ActionSheet, type Action } from '@/ui/ActionSheet'
import { Button, IconButton } from '@/ui/Button'
import { Sheet } from '@/ui/Sheet'
import { toast } from '@/ui/Toast'
import { RestPill } from './RestTimer'
import { useWorkoutUi, workoutUi } from './store'
import { WorkoutEditor } from './WorkoutEditor'

type Confirm =
  | { kind: 'finish' }
  | { kind: 'empty' }
  | { kind: 'filled'; stats: FinishStats }
  | { kind: 'discard' }

/** Идущая тренировка на весь экран. Тянешь вниз — сворачивается в капсулу. */
export function WorkoutScreen({ workout }: { workout: Workout }) {
  const settings = useSettings()
  useWakeLock(settings.keepAwake)
  const now = useNow(1000)
  const entries = useEntries(workout.id)
  const exercises = useExerciseMap()
  const ui = useWorkoutUi()
  const drag = useDragControls()
  const [confirm, setConfirm] = useState<Confirm | null>(null)
  const [renaming, setRenaming] = useState(false)
  const note = useDebouncedSave((v) => void updateWorkout(workout.id, { note: v }))

  const live = useMemo(() => {
    if (!entries || !exercises) return null
    return summarize(
      entries.flatMap((e) => {
        const ex = exercises.get(e.exerciseId)
        return ex ? [{ kind: ex.kind, muscle: ex.muscle, sets: e.sets }] : []
      }),
    )
  }, [entries, exercises])

  const elapsed = Math.max(0, (now - workout.startedAt) / 1000)
  const title = workout.title ?? 'Тренировка'

  async function askFinish() {
    if (!exercises) return
    const kinds = new Map([...exercises.values()].map((e) => [e.id, e.kind]))
    const stats = await finishStats(workout.id, kinds)
    if (stats.doneSets === 0 && stats.filled === 0) setConfirm({ kind: 'empty' })
    else if (stats.filled > 0) setConfirm({ kind: 'filled', stats })
    else setConfirm({ kind: 'finish' })
  }

  async function finish(countFilled: boolean) {
    note.flush()
    await finishWorkout(workout.id, { countFilled })
    workoutUi.showSummary(workout.id)
  }

  async function discard() {
    await discardWorkout(workout.id)
    workoutUi.minimize()
    workoutUi.stopRest()
    toast('Тренировка отменена')
  }

  const confirmActions: Action[] =
    confirm?.kind === 'finish'
      ? [{ label: 'Завершить тренировку', onSelect: () => void finish(false) }]
      : confirm?.kind === 'filled'
        ? [
            {
              label: `Засчитать ${countLabel(confirm.stats.filled, 'подход', 'подхода', 'подходов')} и завершить`,
              onSelect: () => void finish(true),
            },
            { label: 'Завершить без них', destructive: true, onSelect: () => void finish(false) },
          ]
        : confirm?.kind === 'empty' || confirm?.kind === 'discard'
          ? [{ label: 'Отменить тренировку', destructive: true, onSelect: () => void discard() }]
          : []

  const confirmText =
    confirm?.kind === 'filled'
      ? {
          title: 'Есть неотмеченные подходы',
          message: 'Заполненные, но без галочки. Пустые подходы не сохранятся.',
        }
      : confirm?.kind === 'empty'
        ? {
            title: 'Ни одного выполненного подхода',
            message: 'Сохранять нечего — тренировку можно отменить.',
          }
        : confirm?.kind === 'discard'
          ? { title: 'Отменить тренировку?', message: 'Все подходы этой тренировки будут удалены.' }
          : { title: 'Завершить тренировку?', message: undefined }

  return (
    <motion.div
      className="fixed inset-0 z-40 flex flex-col bg-bg"
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', stiffness: 380, damping: 40 }}
      drag="y"
      dragControls={drag}
      dragListener={false}
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={{ top: 0, bottom: 0.7 }}
      onDragEnd={(_, info) => {
        if (info.offset.y > 120 || info.velocity.y > 700) workoutUi.minimize()
      }}
      role="dialog"
      aria-modal="true"
      aria-label={`Тренировка: ${title}`}
    >
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain" data-workout-scroll>
        <header className="sticky top-0 z-30 pt-[var(--safe-top)] hairline-b glass-bar">
          <div
            className="touch-none"
            onPointerDown={(e) => {
              drag.start(e)
            }}
          >
            <div
              className="mx-auto mt-1.5 h-[0.3125rem] w-9 rounded-full bg-fill transition-opacity duration-200"
              data-grabber
              aria-hidden
            />
          </div>
          <div className="flex items-center gap-2 px-3 pt-1 pb-2.5">
            <IconButton label="Свернуть" variant="gray" onClick={workoutUi.minimize}>
              <ChevronDown className="size-6" strokeWidth={2.4} />
            </IconButton>
            <button
              type="button"
              className="min-w-0 flex-1 px-1 text-left"
              onClick={() => {
                setRenaming(true)
              }}
            >
              <div className="truncate text-body font-semibold">{title}</div>
              <div className="truncate font-rounded text-footnote text-label-2 tabular">
                <span className="text-accent">{formatClock(elapsed)}</span>
                {live && live.volume > 0 && <> · {formatVolume(live.volume)}</>}
                {live && <> · {countLabel(live.sets, 'подход', 'подхода', 'подходов')}</>}
              </div>
            </button>
            <Button size="md" className="px-4" onClick={() => void askFinish()}>
              Завершить
            </Button>
          </div>
        </header>

        <div className="pt-3 pb-[calc(var(--safe-bottom)+6rem)]">
          <WorkoutEditor workout={workout} mode="live" />

          <section className="mx-4 mt-6">
            <h3 className="mb-1.5 px-4 text-footnote text-label-2">Заметка к тренировке</h3>
            <textarea
              defaultValue={workout.note ?? ''}
              onChange={(e) => {
                note.change(e.target.value)
              }}
              onBlur={note.flush}
              rows={3}
              placeholder="Самочувствие, сон, что получилось…"
              className="w-full resize-none rounded-[var(--radius-card)] bg-surface px-4 py-3 text-body outline-none placeholder:text-label-3"
            />
          </section>

          <div className="mx-4 mt-6 overflow-hidden rounded-[var(--radius-card)] bg-surface">
            <button
              type="button"
              onClick={() => {
                setRenaming(true)
              }}
              className="flex min-h-12 w-full items-center gap-3 pressable px-4 text-left text-body text-accent"
            >
              <PencilLine className="size-5" aria-hidden /> Переименовать
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirm({ kind: 'discard' })
              }}
              className="flex min-h-12 w-full items-center gap-3 pressable px-4 text-left text-body text-danger hairline-t"
            >
              <Trash2 className="size-5" aria-hidden /> Отменить тренировку
            </button>
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex justify-center px-4 pb-[max(0.75rem,var(--safe-bottom))]">
        <div className="pointer-events-auto w-full max-w-[26rem]">
          <AnimatePresence>{!ui.keypad && <RestPill key="rest" />}</AnimatePresence>
        </div>
      </div>

      <ActionSheet
        open={confirm !== null}
        onClose={() => {
          setConfirm(null)
        }}
        title={confirmText.title}
        message={confirmText.message}
        actions={confirmActions}
        cancelLabel={confirm?.kind === 'empty' ? 'Продолжить' : 'Отмена'}
      />
      <RenameSheet
        open={renaming}
        initial={workout.title ?? ''}
        onClose={() => {
          setRenaming(false)
        }}
        onSave={(t) => void updateWorkout(workout.id, { title: t })}
      />
    </motion.div>
  )
}

export function RenameSheet({
  open,
  initial,
  onClose,
  onSave,
}: {
  open: boolean
  initial: string
  onClose: () => void
  onSave: (title: string) => void
}) {
  return (
    <Sheet open={open} onClose={onClose} title="Название тренировки">
      <RenameForm initial={initial} onClose={onClose} onSave={onSave} />
    </Sheet>
  )
}

function RenameForm({
  initial,
  onClose,
  onSave,
}: {
  initial: string
  onClose: () => void
  onSave: (t: string) => void
}) {
  const [value, setValue] = useState(initial)
  const submit = () => {
    onSave(value)
    onClose()
  }
  return (
    <form
      className="space-y-3 px-4 pb-5"
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      <input
        autoFocus
        value={value}
        onChange={(e) => {
          setValue(e.target.value)
        }}
        placeholder="Например: Грудь и трицепс"
        enterKeyHint="done"
        className="h-12 w-full rounded-[var(--radius-cell)] bg-fill-3 px-4 text-body outline-none placeholder:text-label-3"
      />
      <Button type="submit" block size="lg">
        Сохранить
      </Button>
    </form>
  )
}
