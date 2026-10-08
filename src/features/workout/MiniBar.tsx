import { ChevronUp, Timer } from 'lucide-react'
import { motion } from 'motion/react'
import { formatClock } from '@/domain/format'
import type { Workout } from '@/domain/types'
import { useNow } from '@/lib/useNow'
import { useRestTicker } from './RestTimer'
import { workoutUi } from './store'

/**
 * Капсула идущей тренировки над таб-баром — как мини-плеер в «Музыке».
 * В редакторах таб-бара нет — капсула опускается к нижнему краю, а страница
 * оставляет под неё место (--minibar-space).
 */
export function MiniBar({ workout, tabbar }: { workout: Workout; tabbar: boolean }) {
  const now = useNow(1000)
  const rest = useRestTicker()
  const elapsed = Math.max(0, (now - workout.startedAt) / 1000)
  return (
    <motion.div
      initial={{ y: 30, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 30, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 460, damping: 38 }}
      className="pointer-events-none fixed inset-x-0 z-40 flex justify-center px-4"
      style={{
        bottom: tabbar
          ? 'calc(max(0.5rem, var(--safe-bottom) - 0.5rem) + 4.375rem)'
          : 'max(0.5rem, var(--safe-bottom) - 0.5rem)',
      }}
    >
      <button
        type="button"
        onClick={workoutUi.open}
        className="pointer-events-auto flex h-14 w-full max-w-[26rem] press-scale items-center gap-3 rounded-full pr-3 pl-4 text-left glass"
        aria-label={`Открыть тренировку, идёт ${formatClock(elapsed)}`}
      >
        <span className="relative flex size-3 shrink-0" aria-hidden>
          <span className="absolute inset-0 animate-ping rounded-full bg-success opacity-60" />
          <span className="relative size-3 rounded-full bg-success" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-subhead font-semibold">
            {workout.title ?? 'Тренировка'}
          </span>
          <span className="block font-rounded text-footnote text-label-2 tabular">
            {formatClock(elapsed)}
          </span>
        </span>
        {rest && (
          <span className="flex items-center gap-1 rounded-full bg-accent-soft px-2.5 py-1 font-rounded text-subhead font-semibold text-accent tabular">
            <Timer className="size-4" aria-hidden />
            {rest.left > 0 ? formatClock(rest.left) : 'Пора!'}
          </span>
        )}
        <ChevronUp className="size-5 shrink-0 text-label-2" strokeWidth={2.4} aria-hidden />
      </button>
    </motion.div>
  )
}
