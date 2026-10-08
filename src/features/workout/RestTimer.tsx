import clsx from 'clsx'
import { Timer, X } from 'lucide-react'
import { motion } from 'motion/react'
import { useEffect } from 'react'
import { formatClock } from '@/domain/format'
import { beep } from '@/lib/sound'
import { useNow } from '@/lib/useNow'
import { getSettings } from '@/settings/settings'
import { useWorkoutUi, workoutUi } from './store'

/** Осталось секунд и доля прошедшего отдыха — только чтение, без побочных эффектов. */
export function useRestTicker(): { left: number; progress: number } | null {
  const { rest } = useWorkoutUi()
  const now = useNow(250, rest !== null)
  if (!rest) return null
  const left = Math.max(0, Math.ceil((rest.endsAt - now) / 1000))
  const progress = Math.min(1, Math.max(0, (now - rest.startedAt) / (rest.endsAt - rest.startedAt)))
  return { left, progress }
}

/**
 * Единственный наблюдатель за отдыхом: по окончании — сигнал (если включён)
 * и подсветка; через несколько секунд капсула прячется.
 */
export function RestWatcher() {
  const { rest } = useWorkoutUi()
  const now = useNow(250, rest !== null)
  useEffect(() => {
    if (!rest) return
    if (!rest.finished && now >= rest.endsAt) {
      workoutUi.finishRest()
      if (getSettings().restTimer === 'sound') beep()
    }
    if (rest.finished && now >= rest.endsAt + 4000) workoutUi.stopRest()
  }, [rest, now])
  return null
}

/** Капсула отдыха внизу экрана тренировки: «−15», «+15», пропустить. */
export function RestPill() {
  const { rest } = useWorkoutUi()
  const tick = useRestTicker()
  if (!rest || !tick) return null
  const finished = rest.finished
  return (
    <motion.div
      initial={{ y: 40, opacity: 0, scale: 0.95 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      exit={{ y: 40, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 500, damping: 36 }}
      // glass задаёт background целиком и перекрыл бы зелёный: либо одно, либо другое.
      className={clsx(
        'relative flex h-14 items-center gap-2 overflow-hidden rounded-full pr-2 pl-4',
        finished ? 'bg-success text-white' : 'glass',
      )}
      role="timer"
      aria-live="off"
      aria-label={finished ? 'Отдых окончен' : `Отдых: осталось ${formatClock(tick.left)}`}
    >
      {!finished && (
        <motion.span
          aria-hidden
          className="absolute inset-y-0 left-0 bg-accent-soft"
          style={{ width: `${tick.progress * 100}%` }}
        />
      )}
      <Timer
        className={clsx('relative size-5 shrink-0', finished ? 'text-white' : 'text-accent')}
        aria-hidden
      />
      <span className="relative min-w-0 flex-1 font-rounded text-title-3 font-semibold tabular">
        {finished ? 'Пора!' : formatClock(tick.left)}
      </span>
      {!finished && (
        <>
          <PillButton
            onClick={() => {
              workoutUi.adjustRest(-15)
            }}
          >
            −15
          </PillButton>
          <PillButton
            onClick={() => {
              workoutUi.adjustRest(15)
            }}
          >
            +15
          </PillButton>
        </>
      )}
      <button
        type="button"
        aria-label="Закончить отдых"
        onClick={workoutUi.stopRest}
        className={clsx(
          'relative flex size-10 press-scale items-center justify-center rounded-full',
          finished ? 'bg-white/25' : 'bg-fill-2',
        )}
      >
        <X className="size-5" strokeWidth={2.4} />
      </button>
    </motion.div>
  )
}

function PillButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative h-10 press-scale rounded-full bg-fill-2 px-3 font-rounded text-subhead font-semibold tabular"
    >
      {children}
    </button>
  )
}
