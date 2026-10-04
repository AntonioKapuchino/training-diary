import clsx from 'clsx'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link } from 'react-router'

type Variant = 'filled' | 'tinted' | 'gray' | 'plain' | 'destructive' | 'glass'
type Size = 'lg' | 'md' | 'sm'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  icon?: ReactNode
  block?: boolean
}

const VARIANTS: Record<Variant, string> = {
  filled: 'bg-accent text-on-accent',
  tinted: 'bg-accent-soft text-accent',
  gray: 'bg-fill-2 text-label',
  plain: 'text-accent',
  destructive: 'bg-danger-soft text-danger',
  glass: 'glass text-label',
}

const SIZES: Record<Size, string> = {
  lg: 'h-[3.25rem] px-6 text-body font-semibold gap-2',
  md: 'h-11 px-5 text-body font-semibold gap-2',
  sm: 'h-8 px-3.5 text-subhead font-semibold gap-1.5',
}

/** Кнопки-капсулы iOS 26. */
export function Button({
  variant = 'filled',
  size = 'md',
  icon,
  block,
  className,
  children,
  type = 'button',
  ...rest
}: Props) {
  return (
    <button
      type={type}
      className={clsx(
        'inline-flex shrink-0 press-scale items-center justify-center rounded-full whitespace-nowrap transition-opacity disabled:opacity-40',
        VARIANTS[variant],
        SIZES[size],
        block && 'w-full',
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
    </button>
  )
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string
  variant?: 'glass' | 'gray' | 'tinted' | 'plain' | 'filled'
  size?: 'md' | 'sm'
}

/** Круглая кнопка с иконкой — как кнопки панели навигации в iOS 26. */
export function IconButton({
  label,
  variant = 'glass',
  size = 'md',
  className,
  children,
  type = 'button',
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={clsx(
        'inline-flex shrink-0 press-scale items-center justify-center rounded-full disabled:opacity-40',
        size === 'md' ? 'size-11' : 'size-8',
        variant === 'glass' && 'text-label glass',
        variant === 'gray' && 'bg-fill-2 text-label-2',
        variant === 'tinted' && 'bg-accent-soft text-accent',
        variant === 'plain' && 'text-accent',
        variant === 'filled' && 'bg-accent text-on-accent',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
}

/** Ссылка, которая выглядит как кнопка: кнопку внутри ссылки HTML не разрешает. */
export function ButtonLink({
  to,
  variant = 'filled',
  size = 'md',
  className,
  children,
}: {
  to: string
  variant?: Variant
  size?: Size
  className?: string
  children: ReactNode
}) {
  return (
    <Link
      to={to}
      className={clsx(
        'inline-flex shrink-0 press-scale items-center justify-center rounded-full whitespace-nowrap',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
    >
      {children}
    </Link>
  )
}
