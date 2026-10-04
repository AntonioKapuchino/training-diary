import clsx from 'clsx'
import { ChevronRight, Trophy } from 'lucide-react'
import { Link } from 'react-router'
import { formatRelativeDay, formatTime } from '@/domain/dates'
import { formatDuration, formatVolume } from '@/domain/format'
import { MUSCLE_LABEL } from '@/domain/labels'
import { workoutSeconds } from '@/domain/stats'
import type { Workout } from '@/domain/types'
import { MuscleDots } from '@/ui/MuscleDot'
import { ratingOf } from '../workout/ratings'

/** Название тренировки: своё, иначе по группам мышц. */
export function workoutTitle(w: Workout): string {
  if (w.title) return w.title
  const m = w.summary?.muscles ?? []
  if (m.length === 0) return 'Тренировка'
  return m
    .slice(0, 3)
    .map((x, i) => (i === 0 ? MUSCLE_LABEL[x] : MUSCLE_LABEL[x].toLowerCase()))
    .join(', ')
}

/** Строка тренировки в списке: название, когда, сколько и рекорды. */
export function WorkoutRow({ workout, showDate = true }: { workout: Workout; showDate?: boolean }) {
  const s = workout.summary
  const seconds = workoutSeconds(workout)
  const rating = ratingOf(workout.rating)
  const meta = [
    showDate ? formatRelativeDay(workout.date) : null,
    seconds > 0 ? `${formatTime(workout.startedAt)} · ${formatDuration(seconds)}` : null,
  ].filter(Boolean)
  return (
    <Link
      to={`/history/${workout.id}`}
      className="flex items-center gap-3 pressable pl-4 [&+&>span]:hairline-t"
    >
      <span className="flex min-w-0 flex-1 items-center gap-3 py-3 pr-3">
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-body font-semibold">{workoutTitle(workout)}</span>
            {rating && (
              <span className="text-subhead" aria-label={rating.label}>
                {rating.emoji}
              </span>
            )}
          </span>
          {meta.length > 0 && (
            <span className="mt-0.5 block truncate text-footnote text-label-2">
              {meta.join(' · ')}
            </span>
          )}
          {s && s.exercises > 0 && (
            <span className="mt-1.5 flex items-center gap-2 text-footnote text-label-2">
              <MuscleDots muscles={s.muscles} />
              <span className="tabular">
                {s.exercises} упр.{s.volume > 0 ? ` · ${formatVolume(s.volume)}` : ''}
              </span>
              {s.records > 0 && (
                <span
                  className={clsx('inline-flex items-center gap-0.5 font-semibold text-warning')}
                >
                  <Trophy className="size-3.5" aria-hidden /> {s.records}
                </span>
              )}
            </span>
          )}
        </span>
        <ChevronRight
          className="size-[1.125rem] shrink-0 text-label-3"
          strokeWidth={2.5}
          aria-hidden
        />
      </span>
    </Link>
  )
}
