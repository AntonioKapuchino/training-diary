import { useMemo } from 'react'
import { monotonePath } from './geometry'

interface Props {
  values: readonly number[]
  color: string
  width?: number
  height?: number
}

/** Маленький тренд для списков: линия и точка на последнем значении. */
export function Sparkline({ values, color, width = 64, height = 24 }: Props) {
  const geo = useMemo(() => {
    if (values.length < 2) return null
    const min = Math.min(...values)
    const max = Math.max(...values)
    const pad = 3
    const pts = values.map((v, i) => ({
      x: pad + (i / (values.length - 1)) * (width - pad * 2),
      y: max === min ? height / 2 : pad + (1 - (v - min) / (max - min)) * (height - pad * 2),
    }))
    return { d: monotonePath(pts), last: pts.at(-1) }
  }, [values, width, height])
  if (!geo) return null
  return (
    <svg width={width} height={height} aria-hidden className="shrink-0 overflow-visible">
      <path
        d={geo.d}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {geo.last && (
        <circle
          cx={geo.last.x}
          cy={geo.last.y}
          r={3}
          fill={color}
          stroke="var(--surface)"
          strokeWidth={1.5}
        />
      )}
    </svg>
  )
}
