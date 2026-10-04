import { motion } from 'motion/react'
import type { ReactNode } from 'react'

interface Props {
  /** 0…1, больше единицы — цель перевыполнена. */
  progress: number
  size?: number
  stroke?: number
  color?: string
  children?: ReactNode
  label: string
}

/** Кольцо цели, как кольца активности: дорожка — тот же цвет, только бледнее. */
export function Ring({
  progress,
  size = 88,
  stroke = 12,
  color = 'var(--accent)',
  children,
  label,
}: Props) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const p = Math.max(0, Math.min(1, progress))
  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      role="img"
      aria-label={label}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeOpacity={0.18}
          strokeWidth={stroke}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - p) }}
          transition={{ duration: 0.9, ease: [0.32, 0.72, 0, 1] }}
        />
      </svg>
      {children && (
        <div className="absolute inset-0 flex items-center justify-center">{children}</div>
      )}
    </div>
  )
}
