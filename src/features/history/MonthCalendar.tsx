import clsx from 'clsx'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useMemo } from 'react'
import {
  addDays,
  addMonths,
  formatMonthYear,
  parseISODate,
  startOfMonth,
  startOfWeek,
  todayISO,
  WEEKDAY_SHORT,
} from '@/domain/dates'
import type { MuscleGroup } from '@/domain/types'
import { MuscleDot } from '@/ui/MuscleDot'

interface Props {
  month: string
  onMonth: (month: string) => void
  /** Дата → группы мышц тренировок за день. */
  days: ReadonlyMap<string, MuscleGroup[]>
  onDay: (date: string) => void
}

/** Месяц с отмеченными днями тренировок; под числом — точки групп мышц. */
export function MonthCalendar({ month, onMonth, days, onDay }: Props) {
  const today = todayISO()
  const cells = useMemo(() => {
    const first = startOfMonth(month)
    const start = startOfWeek(first)
    const next = addMonths(first, 1)
    const out: { date: string; inMonth: boolean }[] = []
    for (let d = start; out.length < 42; d = addDays(d, 1)) {
      out.push({ date: d, inMonth: d >= first && d < next })
      if (out.length % 7 === 0 && addDays(d, 1) >= next) break
    }
    return out
  }, [month])
  const canNext = startOfMonth(month) < startOfMonth(today)

  return (
    <div className="rounded-[var(--radius-card)] bg-surface p-3 shadow-[var(--shadow-card)]">
      <div className="mb-2 flex items-center justify-between px-1">
        <h2 className="text-body font-semibold">{formatMonthYear(month, today)}</h2>
        <div className="flex gap-1">
          <button
            type="button"
            aria-label="Предыдущий месяц"
            onClick={() => {
              onMonth(addMonths(month, -1))
            }}
            className="flex size-9 press-scale items-center justify-center rounded-full text-accent"
          >
            <ChevronLeft className="size-5" strokeWidth={2.4} />
          </button>
          <button
            type="button"
            aria-label="Следующий месяц"
            disabled={!canNext}
            onClick={() => {
              onMonth(addMonths(month, 1))
            }}
            className="flex size-9 press-scale items-center justify-center rounded-full text-accent disabled:text-label-3"
          >
            <ChevronRight className="size-5" strokeWidth={2.4} />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 text-center text-caption-2 font-semibold text-label-2">
        {WEEKDAY_SHORT.map((d) => (
          <div key={d} className="pb-1">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-1">
        {cells.map(({ date, inMonth }) => {
          const muscles = days.get(date)
          const trained = muscles !== undefined
          const isToday = date === today
          const day = parseISODate(date).getDate()
          return (
            <button
              key={date}
              type="button"
              disabled={!trained}
              onClick={() => {
                onDay(date)
              }}
              aria-label={trained ? `${day}: тренировка` : undefined}
              className={clsx(
                'flex h-12 flex-col items-center justify-start gap-1 pt-1',
                !inMonth && 'opacity-30',
              )}
            >
              <span
                className={clsx(
                  'flex size-8 items-center justify-center rounded-full font-rounded text-subhead tabular',
                  trained && 'bg-accent-soft font-bold text-accent',
                  isToday && !trained && 'font-semibold shadow-[inset_0_0_0_1.5px_var(--accent)]',
                  !trained && !isToday && 'text-label',
                  date > today && 'text-label-3',
                )}
              >
                {day}
              </span>
              {muscles && (
                <span className="flex h-1.5 gap-0.5">
                  {muscles.slice(0, 3).map((m) => (
                    <MuscleDot key={m} muscle={m} size={5} />
                  ))}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
