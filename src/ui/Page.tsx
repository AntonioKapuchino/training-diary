import clsx from 'clsx'
import { ChevronLeft } from 'lucide-react'
import { motion } from 'motion/react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { IconButton } from './Button'

interface Props {
  title: string
  /** Строка под крупным заголовком: дата, счётчик. */
  subtitle?: ReactNode
  /** Кнопка «назад» для вложенных экранов. */
  back?: boolean | string
  actions?: ReactNode
  /** Заголовок сразу компактный, в панели — для экранов-деталей. */
  inline?: boolean
  /** Место под плавающий таб-бар. */
  tabbar?: boolean
  children: ReactNode
  className?: string
}

/**
 * Экран с крупным заголовком, как в iOS: при прокрутке заголовок уезжает,
 * а в панели сверху появляется компактный на стекле.
 */
export function Page({
  title,
  subtitle,
  back,
  actions,
  inline,
  tabbar = true,
  children,
  className,
}: Props) {
  const sentinel = useRef<HTMLDivElement>(null)
  const [collapsed, setCollapsed] = useState(Boolean(inline))
  const navigate = useNavigate()

  useEffect(() => {
    if (inline) return
    const el = sentinel.current
    if (!el) return
    const io = new IntersectionObserver(
      ([e]) => {
        setCollapsed(!(e?.isIntersecting ?? true))
      },
      { rootMargin: '-60px 0px 0px 0px' },
    )
    io.observe(el)
    return () => {
      io.disconnect()
    }
  }, [inline])

  useEffect(() => {
    document.title = `${title} · Тренировки`
  }, [title])

  const goBack = () => {
    if (typeof back === 'string') void navigate(back)
    else if (window.history.length > 1) void navigate(-1)
    else void navigate('/')
  }

  return (
    <div
      className={clsx(
        'min-h-dvh',
        tabbar
          ? 'pb-[calc(var(--tabbar-space)+var(--minibar-space,0rem))]'
          : 'pb-[calc(var(--safe-bottom)+1.5rem)]',
      )}
    >
      <header
        className={clsx(
          'sticky top-0 z-30 pt-[var(--safe-top)] transition-[background-color,box-shadow] duration-200',
          collapsed && 'hairline-b glass-bar',
        )}
      >
        <div className="relative flex h-11 items-center gap-2 px-4">
          {back && (
            <IconButton label="Назад" onClick={goBack}>
              <ChevronLeft className="size-6 -translate-x-px" strokeWidth={2.4} />
            </IconButton>
          )}
          <motion.h1
            aria-hidden={!collapsed}
            initial={false}
            animate={{ opacity: collapsed ? 1 : 0, y: collapsed ? 0 : 6 }}
            transition={{ duration: 0.18 }}
            className="pointer-events-none absolute inset-x-20 truncate text-center text-body font-semibold"
          >
            {title}
          </motion.h1>
          <div className="ml-auto flex items-center gap-2">{actions}</div>
        </div>
      </header>

      {!inline && (
        <div className="px-5 pt-1 pb-2">
          <h1 className="text-large-title font-bold tracking-tight">{title}</h1>
          {subtitle !== undefined && (
            <div className="mt-0.5 text-subhead text-label-2">{subtitle}</div>
          )}
          <div ref={sentinel} className="h-px" aria-hidden />
        </div>
      )}

      <main className={className}>{children}</main>
    </div>
  )
}
