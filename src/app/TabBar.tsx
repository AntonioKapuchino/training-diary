import clsx from 'clsx'
import { CalendarDays, ChartNoAxesColumn, Dumbbell, House } from 'lucide-react'
import { motion } from 'motion/react'
import { Link, useLocation } from 'react-router'

const TABS = [
  {
    to: '/',
    label: 'Сегодня',
    Icon: House,
    match: (p: string) => p === '/' || p.startsWith('/templates') || p.startsWith('/settings'),
  },
  {
    to: '/history',
    label: 'История',
    Icon: CalendarDays,
    match: (p: string) => p.startsWith('/history'),
  },
  {
    to: '/progress',
    label: 'Прогресс',
    Icon: ChartNoAxesColumn,
    match: (p: string) => p.startsWith('/progress'),
  },
  {
    to: '/exercises',
    label: 'Упражнения',
    Icon: Dumbbell,
    match: (p: string) => p.startsWith('/exercises'),
  },
] as const

/** Плавающий таб-бар iOS 26: стеклянная капсула, выбранная вкладка — на подложке. */
export function TabBar() {
  const { pathname } = useLocation()
  return (
    <nav
      aria-label="Разделы"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[max(0.5rem,calc(var(--safe-bottom)-0.5rem))]"
    >
      <div className="pointer-events-auto flex h-[3.875rem] w-full max-w-[26rem] items-stretch rounded-full p-1 glass">
        {TABS.map(({ to, label, Icon, match }) => {
          const active = match(pathname)
          return (
            // Link, а не NavLink: NavLink сам решает про aria-current и снимает его,
            // когда «Сегодня» подсвечена на программах и настройках.
            <Link
              key={to}
              to={to}
              aria-current={active ? 'page' : undefined}
              className={clsx(
                'relative flex flex-1 flex-col items-center justify-center gap-0.5 rounded-full text-caption-2 font-semibold transition-colors',
                active ? 'text-accent' : 'text-label',
              )}
              onClick={(e) => {
                // Повторное касание активной вкладки — к началу раздела.
                if (active && pathname === to) {
                  e.preventDefault()
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                }
              }}
            >
              {active && (
                <motion.span
                  layoutId="tab-pill"
                  className="absolute inset-0 rounded-full bg-fill-3"
                  transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                />
              )}
              <Icon className="relative size-6" strokeWidth={active ? 2.3 : 1.9} aria-hidden />
              <span className="relative">{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
