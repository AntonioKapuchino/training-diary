import { motion } from 'motion/react'

export interface HBar {
  key: string
  label: string
  value: number
  color: string
}

/**
 * Горизонтальные полосы с подписями: у каждой полосы своя подпись и значение,
 * поэтому цвет — только дополнение, легенда не нужна.
 */
export function HBars({ bars, format }: { bars: readonly HBar[]; format: (v: number) => string }) {
  const max = Math.max(1, ...bars.map((b) => b.value))
  return (
    <ul className="space-y-2.5">
      {bars.map((b, i) => (
        <li key={b.key} className="grid grid-cols-[5.5rem_1fr_auto] items-center gap-3">
          <span className="truncate text-subhead">{b.label}</span>
          <span className="h-2.5 overflow-hidden rounded-full bg-fill-3">
            <motion.span
              className="block h-full rounded-full"
              style={{ background: b.color }}
              initial={{ width: 0 }}
              animate={{ width: `${(b.value / max) * 100}%` }}
              transition={{ duration: 0.6, delay: i * 0.04, ease: [0.32, 0.72, 0, 1] }}
            />
          </span>
          <span className="min-w-8 text-right font-rounded text-subhead font-semibold tabular">
            {format(b.value)}
          </span>
        </li>
      ))}
    </ul>
  )
}
