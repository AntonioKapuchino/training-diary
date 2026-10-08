import clsx from 'clsx'
import { ChevronLeft } from 'lucide-react'
import { motion } from 'motion/react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router'
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
  const header = useRef<HTMLElement>(null)
  const top = useRef<HTMLDivElement>(null)
  const sentinel = useRef<HTMLDivElement>(null)
  // scrolled — под панель заехало содержимое: панель становится стеклянной.
  // collapsed — крупный заголовок целиком ушёл под панель: в ней появляется компактный.
  const [scrolled, setScrolled] = useState(Boolean(inline))
  const [collapsed, setCollapsed] = useState(Boolean(inline))
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    if (inline) return
    const h = header.current?.offsetHeight ?? 60
    const watch = (el: HTMLElement | null, set: (v: boolean) => void, topInset: number) => {
      if (!el) return undefined
      const io = new IntersectionObserver(
        ([e]) => {
          set(!(e?.isIntersecting ?? true))
        },
        { rootMargin: `-${String(topInset)}px 0px 0px 0px` },
      )
      io.observe(el)
      return io
    }
    // Стекло — как только страница сдвинулась. Компактный заголовок — когда крупный ушёл
    // под панель целиком: отступ ровно её высота (с вырезом iPhone 90–106 px, а не 60),
    // иначе заголовок проезжал бы под прозрачной панелью поверх часов и кнопок.
    const a = watch(top.current, setScrolled, 0)
    const b = watch(sentinel.current, setCollapsed, h)
    return () => {
      a?.disconnect()
      b?.disconnect()
    }
  }, [inline])

  useEffect(() => {
    document.title = `${title} · Тренировки`
  }, [title])

  // «Назад» — это шаг назад по истории, как в iOS. Адрес в back — только запасной путь,
  // если экран открыт по ссылке и позади ничего нет; иначе каждое «назад» добавляло бы
  // запись в историю, а из программы, открытой с «Сегодня», вело бы в список программ.
  const goBack = () => {
    if (location.key !== 'default') void navigate(-1)
    else void navigate(typeof back === 'string' ? back : '/', { replace: true })
  }

  return (
    <div
      className={clsx(
        'min-h-dvh',
        tabbar
          ? 'pb-[calc(var(--tabbar-space)+var(--minibar-space,0rem))]'
          : 'pb-[calc(var(--safe-bottom)+1.5rem+var(--minibar-space,0rem))]',
      )}
    >
      <div ref={top} className="-mb-px h-px" aria-hidden />
      <header
        ref={header}
        className={clsx(
          'sticky top-0 z-30 pt-[var(--safe-top)] transition-[background-color,box-shadow] duration-200',
          scrolled && 'hairline-b glass-bar',
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
          <div ref={sentinel} className="h-px" aria-hidden />
          {subtitle !== undefined && (
            <div className="mt-px text-subhead text-label-2">{subtitle}</div>
          )}
        </div>
      )}

      <main className={className}>{children}</main>
    </div>
  )
}
