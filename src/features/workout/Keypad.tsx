import clsx from 'clsx'
import { ChevronDown, Delete, Minus, Plus, Timer } from 'lucide-react'
import { motion } from 'motion/react'
import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { formatClock } from '@/domain/format'
import { haptic } from '@/lib/haptics'
import type { Key } from './keypadLogic'

interface Props {
  title: string
  subtitle: string
  /** Подсказка справа в шапке: раскладка блинов. */
  accessory?: ReactNode
  /** Идёт отдых — секунды до конца; клавиатура закрывает капсулу, поэтому таймер здесь. */
  restLeft?: number | null
  allowDecimal: boolean
  nextLabel: string
  onKey: (key: Key) => void
  onStep: (dir: 1 | -1) => void
  onNext: () => void
  onClose: () => void
}

const DIGITS: Key[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9']

const NON_TEXT = new Set(['checkbox', 'radio', 'button', 'submit', 'range', 'color', 'file'])

/** Поле, куда пользователь печатает текст: там цифры не перехватываем. */
function isTextField(el: EventTarget | null): boolean {
  if (el instanceof HTMLTextAreaElement) return true
  return el instanceof HTMLInputElement && !NON_TEXT.has(el.type)
}

/**
 * Своя цифровая клавиатура вместо системной: не прыгает раскладка, есть «−»/«+»
 * и «Далее», запятая всегда на месте. Высота задаётся переменной --keypad-h,
 * чтобы экран оставлял под неё место.
 */
export function Keypad({
  title,
  subtitle,
  accessory,
  restLeft,
  allowDecimal,
  nextLabel,
  onKey,
  onStep,
  onNext,
  onClose,
}: Props) {
  // Физическая клавиатура — для Mac и тестов.
  // Обработчики — в ref: подписка одна, а вызывается всегда свежая версия.
  const handlers = useRef({ onKey, onNext, onClose })
  useLayoutEffect(() => {
    handlers.current = { onKey, onNext, onClose }
  })
  // Подписка до отрисовки: клавиатура видна — значит, уже слушает.
  useLayoutEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (isTextField(e.target)) return
      const h = handlers.current
      if (/^\d$/.test(e.key)) h.onKey(e.key as Key)
      else if (e.key === ',' || e.key === '.') h.onKey(',')
      else if (e.key === 'Backspace') h.onKey('back')
      else if (e.key === 'Enter' || e.key === 'Tab') h.onNext()
      else if (e.key === 'Escape') h.onClose()
      else return
      e.preventDefault()
    }
    document.addEventListener('keydown', onDown)
    return () => {
      document.removeEventListener('keydown', onDown)
    }
  }, [])

  const press = (fn: () => void) => () => {
    haptic()
    fn()
  }

  return createPortal(
    <motion.div
      role="group"
      aria-label={`Ввод: ${title}`}
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', stiffness: 520, damping: 44 }}
      className="fixed inset-x-0 bottom-0 z-[45] mx-auto max-w-[32rem] rounded-t-[1.75rem] pb-[max(0.5rem,var(--safe-bottom))] shadow-[0_-8px_30px_rgb(0_0_0/0.12)] glass-thick"
      data-keypad
    >
      <div className="flex items-center gap-3 px-4 pt-2.5 pb-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-subhead font-semibold">{title}</div>
          <div className="truncate text-caption text-label-2">{subtitle}</div>
        </div>
        {restLeft !== undefined && restLeft !== null && (
          <span
            role="timer"
            aria-label={`Отдых: ${formatClock(restLeft)}`}
            className="flex shrink-0 items-center gap-1 rounded-full bg-accent-soft px-2.5 py-1 font-rounded text-subhead font-semibold text-accent tabular"
          >
            <Timer className="size-4" aria-hidden />
            {restLeft > 0 ? formatClock(restLeft) : 'Пора'}
          </span>
        )}
        {accessory && (
          <div className="shrink-0 text-right text-caption text-label-2">{accessory}</div>
        )}
        <button
          type="button"
          aria-label="Скрыть клавиатуру"
          onClick={press(onClose)}
          className="flex size-9 shrink-0 press-scale items-center justify-center rounded-full bg-fill-2 text-label-2"
        >
          <ChevronDown className="size-5" strokeWidth={2.4} />
        </button>
      </div>
      <div className="grid grid-cols-4 gap-1.5 px-2">
        {DIGITS.slice(0, 3).map((d) => (
          <Digit key={d} d={d} onKey={onKey} />
        ))}
        <KeyButton
          variant="aux"
          label="Меньше"
          onClick={press(() => {
            onStep(-1)
          })}
        >
          <Minus className="size-6" strokeWidth={2.4} />
        </KeyButton>
        {DIGITS.slice(3, 6).map((d) => (
          <Digit key={d} d={d} onKey={onKey} />
        ))}
        <KeyButton
          variant="aux"
          label="Больше"
          onClick={press(() => {
            onStep(1)
          })}
        >
          <Plus className="size-6" strokeWidth={2.4} />
        </KeyButton>
        {DIGITS.slice(6, 9).map((d) => (
          <Digit key={d} d={d} onKey={onKey} />
        ))}
        <button
          type="button"
          onClick={press(onNext)}
          className="row-span-2 flex press-scale items-center justify-center rounded-[0.875rem] bg-accent px-1 text-body font-semibold text-on-accent"
        >
          {nextLabel}
        </button>
        <KeyButton
          label="Запятая"
          disabled={!allowDecimal}
          onClick={press(() => {
            onKey(',')
          })}
        >
          ,
        </KeyButton>
        <Digit d="0" onKey={onKey} />
        <KeyButton
          label="Стереть"
          variant="aux"
          onClick={press(() => {
            onKey('back')
          })}
        >
          <Delete className="size-6" strokeWidth={2} />
        </KeyButton>
      </div>
    </motion.div>,
    document.body,
  )
}

function Digit({ d, onKey }: { d: Key; onKey: (key: Key) => void }) {
  return (
    <KeyButton
      onClick={() => {
        haptic()
        onKey(d)
      }}
    >
      {d}
    </KeyButton>
  )
}

function KeyButton({
  children,
  onClick,
  label,
  variant = 'digit',
  disabled,
  className,
}: {
  children: ReactNode
  onClick: () => void
  label?: string
  variant?: 'digit' | 'aux'
  disabled?: boolean
  className?: string
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={clsx(
        'flex h-[3.25rem] items-center justify-center rounded-[0.875rem] font-rounded text-[1.625rem] font-medium transition-[transform,background-color] duration-100 active:scale-95 disabled:opacity-30',
        variant === 'digit'
          ? 'bg-surface text-label shadow-[0_1px_0_rgb(0_0_0/0.08)] active:bg-surface-3 dark:bg-surface-3 dark:active:bg-fill'
          : 'bg-fill-2 text-label active:bg-fill',
        className,
      )}
    >
      {children}
    </button>
  )
}
