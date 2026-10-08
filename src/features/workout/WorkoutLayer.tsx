import { AnimatePresence } from 'motion/react'
import { useEffect, useRef } from 'react'
import { useActiveWorkout } from '@/db/hooks'
import { MiniBar } from './MiniBar'
import { RestWatcher } from './RestTimer'
import { useWorkoutUi, workoutUi } from './store'
import { SummaryScreen } from './SummaryScreen'
import { WorkoutScreen } from './WorkoutScreen'

/** Всё про идущую тренировку поверх вкладок: капсула, полный экран, итоги. */
export function WorkoutLayer({ tabbar }: { tabbar: boolean }) {
  const active = useActiveWorkout()
  const ui = useWorkoutUi()

  // Тренировка была и пропала (например, данные заменили импортом) — сворачиваем экран.
  // Только на переходе: сразу после старта живой запрос ещё не видит новую тренировку,
  // и проверка «нет тренировки» свернула бы её тут же.
  const had = useRef(false)
  useEffect(() => {
    if (active) had.current = true
    else if (active === null && had.current) {
      had.current = false
      if (ui.expanded) workoutUi.minimize()
    }
  }, [active, ui.expanded])

  return (
    <>
      <RestWatcher />
      <AnimatePresence>
        {active && !ui.expanded && <MiniBar key="mini" workout={active} tabbar={tabbar} />}
      </AnimatePresence>
      <AnimatePresence>
        {active && ui.expanded && <WorkoutScreen key="screen" workout={active} />}
      </AnimatePresence>
      <SummaryScreen />
    </>
  )
}
