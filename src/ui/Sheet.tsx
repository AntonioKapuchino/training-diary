import clsx from 'clsx'
import { AnimatePresence, motion, useDragControls, useIsPresent, type PanInfo } from 'motion/react'
import { useEffect, useId, useLayoutEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useKeyboardInset } from './useKeyboardInset'

interface Props {
  open: boolean
  onClose: () => void
  title?: ReactNode
  /** Кнопки по краям заголовка: «Отмена» слева, «Готово» справа. */
  leading?: ReactNode
  trailing?: ReactNode
  children: ReactNode
  /** full — почти на весь экран (выбор упражнения), auto — по содержимому. */
  height?: 'auto' | 'full'
  /** Прячет полоску-ручку и заголовок: содержимое рисует их само. */
  bare?: boolean
  className?: string
  label?: string
}

const SPRING = { type: 'spring', stiffness: 420, damping: 40, mass: 0.9 } as const

let openSheets = 0
/** Открытые шторки по порядку: Escape закрывает только верхнюю. */
const stack: symbol[] = []

/** Блокировка прокрутки страницы, пока открыта хотя бы одна шторка. */
function lockScroll(): () => void {
  openSheets++
  // data-sheet — для стилей того, что под шторкой: ручка экрана тренировки прячется,
  // иначе над шторкой выбора упражнений торчали бы две ручки.
  if (openSheets === 1) {
    document.documentElement.style.overflow = 'hidden'
    document.documentElement.dataset.sheet = 'open'
  }
  return () => {
    openSheets--
    if (openSheets === 0) {
      document.documentElement.style.overflow = ''
      delete document.documentElement.dataset.sheet
    }
  }
}

/**
 * Шторка снизу, как в iOS 26: плавает с отступами, тянется вниз за ручку,
 * закрывается свайпом, по фону и по Escape.
 */
export function Sheet(props: Props) {
  return createPortal(
    <AnimatePresence>{props.open && <SheetBody {...props} />}</AnimatePresence>,
    document.body,
  )
}

function SheetBody({
  onClose,
  title,
  leading,
  trailing,
  children,
  height = 'auto',
  bare,
  className,
  label,
}: Props) {
  const titleId = useId()
  const panel = useRef<HTMLDivElement>(null)
  const drag = useDragControls()
  const keyboard = useKeyboardInset()
  // Закрывающаяся шторка ещё видна, но касаний уже не принимает: второе быстрое
  // нажатие «Добавить» иначе добавило бы упражнения дважды.
  const present = useIsPresent()
  // onClose приходит новой функцией на каждой отрисовке родителя (экран тренировки
  // обновляется раз в секунду). Эффект ниже не должен из-за этого перезапускаться:
  // иначе он раз в секунду забирал бы фокус у поля ввода и прятал клавиатуру.
  const closeRef = useRef(onClose)
  useLayoutEffect(() => {
    closeRef.current = onClose
  })

  useEffect(() => {
    const unlock = lockScroll()
    const me = Symbol('sheet')
    stack.push(me)
    const prev = document.activeElement as HTMLElement | null
    // Поле с autoFocus уже в фокусе — не перебиваем его, иначе клавиатура не появится.
    if (!panel.current?.contains(document.activeElement)) {
      panel.current?.focus({ preventScroll: true })
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && stack.at(-1) === me) closeRef.current()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      stack.splice(stack.indexOf(me), 1)
      unlock()
      prev?.focus({ preventScroll: true })
    }
  }, [])

  function onDragEnd(_: unknown, info: PanInfo) {
    if (info.offset.y > 120 || info.velocity.y > 700) onClose()
  }

  const full = height === 'full'
  const hasHeader = title !== undefined || Boolean(leading) || Boolean(trailing)

  return (
    <div
      className={clsx(
        'fixed inset-0 z-50 flex flex-col justify-end',
        !present && 'pointer-events-none',
      )}
      inert={!present}
      style={{ paddingBottom: keyboard }}
    >
      <motion.div
        aria-hidden
        className="absolute inset-0 bg-[var(--backdrop)]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        onClick={onClose}
      />
      <motion.div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-label={title ? undefined : label}
        tabIndex={-1}
        drag="y"
        dragControls={drag}
        dragListener={false}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0.05, bottom: 0.9 }}
        onDragEnd={onDragEnd}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={SPRING}
        // Клавиатура поднимает шторку на свою высоту — на столько же шторка и ниже,
        // иначе её верх (заголовок, поле поиска) уехал бы за экран.
        style={
          full
            ? { height: `calc(100dvh - var(--safe-top) - 0.75rem - ${keyboard}px)` }
            : { maxHeight: `calc(100dvh - var(--safe-top) - 1.5rem - ${keyboard}px)` }
        }
        className={clsx(
          'relative mx-auto flex w-full max-w-[32rem] flex-col overflow-hidden bg-surface outline-none',
          full
            ? 'rounded-t-[var(--radius-sheet)]'
            : 'mb-[max(0.5rem,var(--safe-bottom))] w-[calc(100%-1rem)] rounded-[var(--radius-sheet)]',
          'shadow-[0_-4px_40px_rgb(0_0_0/0.18)]',
          className,
        )}
      >
        {!bare && (
          <div
            className="shrink-0 touch-none select-none"
            onPointerDown={(e) => {
              drag.start(e)
            }}
          >
            <div className="mx-auto mt-2 h-[0.3125rem] w-9 rounded-full bg-fill" aria-hidden />
            {hasHeader && (
              <div className="grid min-h-12 grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 pt-1 pb-2">
                <div className="flex justify-start">{leading}</div>
                {title !== undefined && (
                  <h2 id={titleId} className="truncate text-center text-body font-semibold">
                    {title}
                  </h2>
                )}
                <div className="flex justify-end">{trailing}</div>
              </div>
            )}
          </div>
        )}
        <div
          className={clsx(
            'min-h-0 flex-1 overflow-y-auto overscroll-contain',
            full && 'pb-[var(--safe-bottom)]',
          )}
        >
          {children}
        </div>
      </motion.div>
    </div>
  )
}
