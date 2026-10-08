import { motion } from 'motion/react'
import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router'
import { useActiveWorkout } from '@/db/hooks'
import { useWorkoutUi } from '@/features/workout/store'
import { WorkoutLayer } from '@/features/workout/WorkoutLayer'
import { toast, Toaster } from '@/ui/Toast'
import { ScrollMemory } from './ScrollMemory'
import { TabBar } from './TabBar'
import { registerServiceWorker, reloadNow } from './serviceWorker'

const ROOTS = new Set(['/', '/history', '/progress', '/exercises'])

/** Каркас: экран, таб-бар, капсула идущей тренировки, уведомления. */
export function Layout() {
  const { pathname } = useLocation()
  const active = useActiveWorkout()
  const ui = useWorkoutUi()
  const nested = !ROOTS.has(pathname)
  // В редакторах таб-бар прячется, как hidesBottomBarWhenPushed в iOS.
  const editing = /^\/templates\/[^/]+$/.test(pathname) || pathname.endsWith('/edit')
  // Высота над нижним краем: таб-бар 62 + отступ, и капсула тренировки, если она есть.
  const bottom = 78 + (active && !ui.expanded ? 64 : 0)

  useEffect(() => {
    registerServiceWorker(() => {
      toast(
        'Новая версия загружена — обновится, когда свернёшь приложение',
        { label: 'Сейчас', onAction: reloadNow },
        8000,
      )
    })
  }, [])

  return (
    <>
      <ScrollMemory />
      <motion.div
        key={pathname}
        // Вложенный экран въезжает справа, как push в iOS; вкладки — без анимации.
        initial={nested ? { opacity: 0, x: 28 } : false}
        animate={{ opacity: 1, x: 0 }}
        transition={{ type: 'spring', stiffness: 380, damping: 38 }}
        style={{ ['--minibar-space' as string]: active ? '4rem' : '0rem' }}
      >
        <Outlet />
      </motion.div>
      {!editing && <TabBar />}
      <WorkoutLayer tabbar={!editing} />
      <Toaster offset={bottom} top={Boolean(active) && ui.expanded} />
    </>
  )
}
