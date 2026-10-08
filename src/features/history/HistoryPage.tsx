import { CalendarDays, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { useDoneWorkouts } from '@/db/hooks'
import { addMonths, formatMonthYear, startOfMonth, todayISO } from '@/domain/dates'
import { countLabel, formatDuration, formatVolume } from '@/domain/format'
import { workoutSeconds } from '@/domain/stats'
import type { MuscleGroup, Workout } from '@/domain/types'
import { useSessionState } from '@/lib/sessionState'
import { IconButton } from '@/ui/Button'
import { EmptyState } from '@/ui/EmptyState'
import { Section } from '@/ui/List'
import { Page } from '@/ui/Page'
import { PastWorkoutSheet } from '../today/StartSheet'
import { MonthCalendar } from './MonthCalendar'
import { WorkoutRow } from './WorkoutRow'

export function HistoryPage() {
  const workouts = useDoneWorkouts()
  const navigate = useNavigate()
  const [month, setMonth] = useSessionState('history.month', startOfMonth(todayISO()))
  const [pastOpen, setPastOpen] = useState(false)

  const days = useMemo(() => {
    const map = new Map<string, MuscleGroup[]>()
    for (const w of workouts ?? []) {
      const prev = map.get(w.date) ?? []
      map.set(w.date, [...new Set([...prev, ...(w.summary?.muscles ?? [])])])
    }
    return map
  }, [workouts])

  const groups = useMemo(() => {
    const out: { month: string; items: Workout[] }[] = []
    for (const w of workouts ?? []) {
      const m = startOfMonth(w.date)
      const last = out.at(-1)
      if (last?.month === m) last.items.push(w)
      else out.push({ month: m, items: [w] })
    }
    return out
  }, [workouts])

  const monthStats = useMemo(() => {
    const next = addMonths(month, 1)
    const list = (workouts ?? []).filter((w) => w.date >= month && w.date < next)
    return {
      count: list.length,
      seconds: list.reduce((s, w) => s + workoutSeconds(w), 0),
      volume: list.reduce((s, w) => s + (w.summary?.volume ?? 0), 0),
    }
  }, [workouts, month])

  const today = todayISO()

  return (
    <Page
      title="История"
      subtitle={
        workouts ? countLabel(workouts.length, 'тренировка', 'тренировки', 'тренировок') : undefined
      }
      actions={
        <IconButton
          label="Внести прошлую тренировку"
          onClick={() => {
            setPastOpen(true)
          }}
        >
          <Plus className="size-5" strokeWidth={2.4} />
        </IconButton>
      }
    >
      {workouts?.length === 0 ? (
        <EmptyState
          icon={<CalendarDays />}
          title="Пока пусто"
          message="Завершённые тренировки появятся здесь. Забыл записать в зале — нажми «+» и внеси задним числом."
        />
      ) : (
        <>
          <Section plain>
            <MonthCalendar
              month={month}
              onMonth={setMonth}
              days={days}
              onDay={(date) => {
                const w = workouts?.find((x) => x.date === date)
                if (w) void navigate(`/history/${w.id}`)
              }}
            />
            <p className="mt-2 px-4 text-footnote text-label-2 tabular">
              {monthStats.count === 0
                ? 'В этом месяце тренировок нет'
                : [
                    countLabel(monthStats.count, 'тренировка', 'тренировки', 'тренировок'),
                    monthStats.seconds > 0 ? formatDuration(monthStats.seconds) : null,
                    monthStats.volume > 0 ? formatVolume(monthStats.volume) : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
            </p>
          </Section>

          {groups.map((g) => (
            <Section
              key={g.month}
              header={`${formatMonthYear(g.month, today)} · ${g.items.length}`}
            >
              {g.items.map((w) => (
                <WorkoutRow key={w.id} workout={w} />
              ))}
            </Section>
          ))}
        </>
      )}

      <PastWorkoutSheet
        open={pastOpen}
        onClose={() => {
          setPastOpen(false)
        }}
        onCreated={() => undefined}
      />
    </Page>
  )
}
