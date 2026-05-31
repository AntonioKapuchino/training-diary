import { useMemo } from 'react'

export interface ChartPoint { label: string; value: number }

interface Props {
  data: ChartPoint[]
  color?: string
  unit?: string
  height?: number
}

/** Лёгкий SVG-график линии с заливкой и точками. Без зависимостей. */
export default function LineChart({ data, color = '#5b5bd6', unit = '', height = 180 }: Props) {
  const W = 320
  const H = height
  const padX = 12
  const padTop = 18
  const padBottom = 26

  const geom = useMemo(() => {
    if (data.length === 0) return null
    const values = data.map((d) => d.value)
    const min = Math.min(...values)
    const max = Math.max(...values)
    const range = max - min || 1
    // небольшой запас сверху/снизу
    const lo = min - range * 0.12
    const hi = max + range * 0.12
    const span = hi - lo || 1
    const innerW = W - padX * 2
    const innerH = H - padTop - padBottom

    const x = (i: number) =>
      data.length === 1 ? W / 2 : padX + (i / (data.length - 1)) * innerW
    const y = (v: number) => padTop + innerH - ((v - lo) / span) * innerH

    const pts = data.map((d, i) => ({ x: x(i), y: y(d.value), ...d }))
    const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
    const area = `${line} L ${pts[pts.length - 1].x.toFixed(1)} ${H - padBottom} L ${pts[0].x.toFixed(1)} ${H - padBottom} Z`
    return { pts, line, area, max, min }
  }, [data, H])

  const id = useMemo(() => 'g' + Math.random().toString(36).slice(2, 8), [])
  if (!geom) return null

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" style={{ display: 'block' }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={geom.area} fill={`url(#${id})`} />
      <path d={geom.line} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      {geom.pts.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r={3.5} fill="#fff" stroke={color} strokeWidth={2.5} />
          {(i === 0 || i === geom.pts.length - 1 || p.value === geom.max) && (
            <text x={p.x} y={p.y - 9} fontSize="11" fontWeight="700" textAnchor="middle" style={{ fill: 'var(--text)' }}>
              {p.value}{unit}
            </text>
          )}
          {(i === 0 || i === geom.pts.length - 1) && (
            <text x={p.x} y={H - 8} fontSize="10" textAnchor={i === 0 ? 'start' : 'end'} style={{ fill: 'var(--text-3)' }}>
              {p.label}
            </text>
          )}
        </g>
      ))}
    </svg>
  )
}
