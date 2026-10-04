import { CalendarPlus, ChevronRight, Plus, RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useDoneWorkouts, useTemplates } from '@/db/hooks'
import { createPastWorkout, startWorkout } from '@/db/workouts'
import { addDays, formatRelativeDay, isISODate, todayISO } from '@/domain/dates'
import { haptic } from '@/lib/haptics'
import { Button } from '@/ui/Button'
import { Sheet } from '@/ui/Sheet'
import { workoutTitle } from '../history/WorkoutRow'
import { workoutUi } from '../workout/store'

/** Запуск тренировки: пустая, повтор последней, по программе или запись задним числом. */
export function StartSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Новая тренировка">
      <StartOptions onClose={onClose} />
    </Sheet>
  )
}

export async function begin(opts: Parameters<typeof startWorkout>[0] = {}): Promise<void> {
  haptic()
  await startWorkout(opts)
  workoutUi.open()
}

function StartOptions({ onClose }: { onClose: () => void }) {
  const templates = useTemplates()
  const workouts = useDoneWorkouts()
  const last = workouts?.[0]
  const [pastOpen, setPastOpen] = useState(false)

  const go = (opts: Parameters<typeof startWorkout>[0]) => {
    onClose()
    void begin(opts)
  }

  return (
    <div className="px-4 pb-5">
      <div className="overflow-hidden rounded-[var(--radius-card)] bg-fill-3">
        <Option
          icon={<Plus />}
          title="Пустая тренировка"
          subtitle="Упражнения добавишь по ходу"
          onClick={() => {
            go({})
          }}
        />
        {last && (
          <Option
            icon={<RotateCcw />}
            title={`Повторить: ${workoutTitle(last)}`}
            subtitle={formatRelativeDay(last.date)}
            onClick={() => {
              go({ repeatOf: last.id })
            }}
          />
        )}
        <Option
          icon={<CalendarPlus />}
          title="Внести прошлую тренировку"
          subtitle="Если забыл записать в зале"
          onClick={() => {
            setPastOpen(true)
          }}
        />
      </div>

      {templates && templates.length > 0 && (
        <>
          <h3 className="mt-5 mb-1.5 px-4 text-footnote text-label-2">Программы</h3>
          <div className="overflow-hidden rounded-[var(--radius-card)] bg-fill-3">
            {templates.map((t) => (
              <Option
                key={t.id}
                title={t.name}
                subtitle={`${t.exercises.length} упр.`}
                onClick={() => {
                  go({ templateId: t.id })
                }}
              />
            ))}
          </div>
        </>
      )}

      <PastWorkoutSheet
        open={pastOpen}
        onClose={() => {
          setPastOpen(false)
        }}
        onCreated={onClose}
      />
    </div>
  )
}

function Option({
  icon,
  title,
  subtitle,
  onClick,
}: {
  icon?: React.ReactNode
  title: string
  subtitle?: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 pressable pl-4 text-left [&+&>span:last-child]:hairline-t"
    >
      {icon && (
        <span
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent [&_svg]:size-[1.125rem]"
          aria-hidden
        >
          {icon}
        </span>
      )}
      <span className="flex min-h-14 min-w-0 flex-1 items-center gap-2 py-2.5 pr-4">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-body">{title}</span>
          {subtitle && (
            <span className="block truncate text-footnote text-label-2">{subtitle}</span>
          )}
        </span>
        <ChevronRight
          className="size-[1.125rem] shrink-0 text-label-3"
          strokeWidth={2.5}
          aria-hidden
        />
      </span>
    </button>
  )
}

/** Дата и время прошлой тренировки. Пустая дата не принимается. */
export function PastWorkoutSheet({
  open,
  onClose,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  onCreated: () => void
}) {
  return (
    <Sheet open={open} onClose={onClose} title="Прошлая тренировка">
      <PastForm onClose={onClose} onCreated={onCreated} />
    </Sheet>
  )
}

function PastForm({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const navigate = useNavigate()
  const [date, setDate] = useState(addDays(todayISO(), -1))
  const [time, setTime] = useState('18:00')
  const valid = isISODate(date) && date <= todayISO() && /^\d{2}:\d{2}$/.test(time)

  async function create() {
    if (!valid) return
    const id = await createPastWorkout(date, time)
    onClose()
    onCreated()
    void navigate(`/history/${id}/edit`)
  }

  return (
    <div className="space-y-3 px-4 pb-5">
      <div className="overflow-hidden rounded-[var(--radius-card)] bg-fill-3">
        <label className="flex min-h-12 items-center justify-between gap-3 px-4">
          <span className="text-body">Дата</span>
          <input
            type="date"
            value={date}
            max={todayISO()}
            onChange={(e) => {
              setDate(e.target.value)
            }}
            className="bg-transparent text-right text-body text-accent outline-none"
          />
        </label>
        <label className="flex min-h-12 items-center justify-between gap-3 px-4 hairline-t">
          <span className="text-body">Начало</span>
          <input
            type="time"
            value={time}
            onChange={(e) => {
              setTime(e.target.value)
            }}
            className="bg-transparent text-right text-body text-accent outline-none"
          />
        </label>
      </div>
      {!isISODate(date) && (
        <p className="px-4 text-footnote text-danger">Выбери дату тренировки.</p>
      )}
      <Button block size="lg" disabled={!valid} onClick={() => void create()}>
        Продолжить
      </Button>
    </div>
  )
}
