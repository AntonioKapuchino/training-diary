import clsx from 'clsx'
import { motion } from 'motion/react'
import { useId } from 'react'

interface Option<T extends string> {
  value: T
  label: string
}

interface Props<T extends string> {
  value: T
  options: readonly Option<T>[]
  onChange: (value: T) => void
  label: string
  className?: string
}

/** Сегментированный переключатель iOS с плавающим ползунком. */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  className,
}: Props<T>) {
  const id = useId()
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={clsx('relative flex h-8 rounded-[0.5625rem] bg-fill-3 p-0.5', className)}
    >
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => {
              onChange(o.value)
            }}
            className="relative flex-1 rounded-[0.4375rem] px-2 text-footnote font-semibold"
          >
            {active && (
              <motion.span
                layoutId={`seg-${id}`}
                className="absolute inset-0 rounded-[0.4375rem] bg-surface shadow-[0_3px_8px_rgb(0_0_0/0.12),0_3px_1px_rgb(0_0_0/0.04)] dark:bg-surface-3"
                transition={{ type: 'spring', stiffness: 500, damping: 40 }}
              />
            )}
            <span className={clsx('relative', active ? 'text-label' : 'text-label-2')}>
              {o.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}
