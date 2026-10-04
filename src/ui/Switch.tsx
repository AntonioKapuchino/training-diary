import clsx from 'clsx'
import { haptic } from '@/lib/haptics'

interface Props {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  disabled?: boolean
}

/** Переключатель iOS. */
export function Switch({ checked, onChange, label, disabled }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => {
        haptic()
        onChange(!checked)
      }}
      className={clsx(
        'relative h-[1.9375rem] w-[3.1875rem] shrink-0 rounded-full transition-colors duration-200 disabled:opacity-40',
        checked ? 'bg-success' : 'bg-fill',
      )}
    >
      <span
        className={clsx(
          'absolute top-0.5 left-0.5 size-[1.6875rem] rounded-full bg-white shadow-[0_3px_8px_rgb(0_0_0/0.15),0_1px_1px_rgb(0_0_0/0.16)] transition-transform duration-200 ease-[var(--ease-ios)]',
          checked && 'translate-x-5',
        )}
      />
    </button>
  )
}
