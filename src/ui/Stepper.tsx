import { Minus, Plus } from 'lucide-react'
import { haptic } from '@/lib/haptics'

interface Props {
  value: number
  onChange: (value: number) => void
  min: number
  max: number
  step?: number
  label: string
  format?: (v: number) => string
}

/** Степпер iOS: «−» и «+» в одной капсуле, значение слева. */
export function Stepper({ value, onChange, min, max, step = 1, label, format = String }: Props) {
  const set = (v: number) => {
    const next = Math.min(max, Math.max(min, Number(v.toFixed(2))))
    if (next !== value) {
      haptic()
      onChange(next)
    }
  }
  return (
    <div className="flex items-center gap-3">
      <span className="min-w-12 text-right text-body text-label-2 tabular" aria-live="polite">
        {format(value)}
      </span>
      <div className="flex h-8 items-center rounded-[0.5625rem] bg-fill-3">
        <button
          type="button"
          aria-label={`${label}: меньше`}
          disabled={value <= min}
          onClick={() => {
            set(value - step)
          }}
          className="flex h-full w-11 items-center justify-center disabled:opacity-30"
        >
          <Minus className="size-4" strokeWidth={2.6} />
        </button>
        <span className="h-4 w-px bg-separator" aria-hidden />
        <button
          type="button"
          aria-label={`${label}: больше`}
          disabled={value >= max}
          onClick={() => {
            set(value + step)
          }}
          className="flex h-full w-11 items-center justify-center disabled:opacity-30"
        >
          <Plus className="size-4" strokeWidth={2.6} />
        </button>
      </div>
    </div>
  )
}
