import clsx from 'clsx'
import { ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'

interface SectionProps {
  /** Мелкая серая подпись над группой, как в «Настройках». */
  header?: ReactNode
  /** Крупный заголовок раздела, как в «Здоровье». */
  title?: ReactNode
  /** Действие справа от крупного заголовка: «Все». */
  action?: ReactNode
  footer?: ReactNode
  children: ReactNode
  /** Без белой подложки — для собственных карточек внутри раздела. */
  plain?: boolean
  className?: string
}

/** Группа ячеек iOS (inset grouped). */
export function Section({
  header,
  title,
  action,
  footer,
  children,
  plain,
  className,
}: SectionProps) {
  return (
    <section className={clsx('mx-4 mt-7 first:mt-2', className)}>
      {title !== undefined && (
        <div className="mb-2.5 flex items-end justify-between gap-3 px-1">
          <h2 className="text-title-3 font-bold">{title}</h2>
          {action}
        </div>
      )}
      {header !== undefined && <h3 className="mb-1.5 px-4 text-footnote text-label-2">{header}</h3>}
      {plain ? (
        children
      ) : (
        <div className="overflow-hidden rounded-[var(--radius-card)] bg-surface shadow-[var(--shadow-card)]">
          {children}
        </div>
      )}
      {footer !== undefined && <p className="mt-2 px-4 text-footnote text-label-2">{footer}</p>}
    </section>
  )
}

interface RowProps {
  title: ReactNode
  subtitle?: ReactNode
  /** Значение справа серым: «3 в неделю». */
  value?: ReactNode
  /** Произвольный элемент справа: переключатель, бейдж. */
  trailing?: ReactNode
  /** Иконка в цветном скруглённом квадрате слева, как в «Настройках». */
  icon?: ReactNode
  iconBg?: string
  /** Элемент слева без подложки: точка группы мышц и т. п. */
  leading?: ReactNode
  chevron?: boolean
  destructive?: boolean
  accent?: boolean
  onClick?: () => void
  to?: string
  disabled?: boolean
  className?: string
}

/** Ячейка списка. Разделитель рисуется сверху у всех, кроме первой. */
export function Row({
  title,
  subtitle,
  value,
  trailing,
  icon,
  iconBg,
  leading,
  chevron,
  destructive,
  accent,
  onClick,
  to,
  disabled,
  className,
}: RowProps) {
  const interactive = Boolean(onClick ?? to)
  const body = (
    <>
      {icon && (
        <span
          className="flex size-[1.875rem] shrink-0 items-center justify-center rounded-[0.5rem] text-white [&_svg]:size-[1.125rem]"
          style={{ background: iconBg ?? 'var(--accent)' }}
          aria-hidden
        >
          {icon}
        </span>
      )}
      {leading}
      <span className="relative flex min-h-[2.75rem] min-w-0 flex-1 items-center gap-3 py-2.5 pr-4 before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:origin-top before:scale-y-50 before:bg-separator">
        <span className="min-w-0 flex-1 text-left">
          <span
            className={clsx(
              'block truncate text-body',
              destructive && 'text-danger',
              accent && 'text-accent',
            )}
          >
            {title}
          </span>
          {subtitle !== undefined && (
            <span className="mt-0.5 block truncate text-footnote text-label-2">{subtitle}</span>
          )}
        </span>
        {value !== undefined && <span className="shrink-0 text-body text-label-2">{value}</span>}
        {trailing}
        {chevron && (
          <ChevronRight
            className="size-[1.125rem] shrink-0 text-label-3"
            strokeWidth={2.5}
            aria-hidden
          />
        )}
      </span>
    </>
  )
  const cls = clsx(
    'group flex w-full items-center gap-3 pl-4 text-left [&:first-child>span:last-child]:before:hidden',
    interactive && !disabled && 'pressable',
    disabled && 'opacity-40',
    className,
  )
  if (to && !disabled) {
    return (
      <Link to={to} className={cls}>
        {body}
      </Link>
    )
  }
  if (onClick) {
    return (
      <button type="button" className={cls} onClick={onClick} disabled={disabled}>
        {body}
      </button>
    )
  }
  return <div className={cls}>{body}</div>
}
