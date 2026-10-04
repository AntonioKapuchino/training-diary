import { useState } from 'react'
import { niceTicks } from './geometry'
import { useMeasure } from './useMeasure'

export interface Bar {
  key: string
  value: number
  /** Подпись под столбиком. */
  label: string
  /** Подпись в подсказке: «Неделя 22–28 сент.». */
  title: string
  /** Выделенный столбик (текущая неделя) — в цвете акцента, остальные серые. */
  highlight?: boolean
}

interface Props {
  bars: readonly Bar[]
  format: (v: number) => string
  height?: number
  label: string
}

const PAD = { top: 22, right: 36, bottom: 22 }
const R = 4

/** Столбик со скруглённым верхом и плоским основанием. */
function barPath(x: number, y: number, w: number, h: number): string {
  if (h <= 0) return ''
  const r = Math.min(R, w / 2, h)
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`
}

/** Столбики по неделям: не толще 24 px, между ними воздух. */
export function Bars({ bars, format, height = 160, label }: Props) {
  const [ref, width] = useMeasure<HTMLDivElement>()
  const [active, setActive] = useState<number | null>(null)
  const max = Math.max(1, ...bars.map((b) => b.value))
  const ticks = niceTicks(0, max, 2)
  const top = ticks.at(-1) ?? max
  const innerW = Math.max(0, width - PAD.right)
  const innerH = height - PAD.top - PAD.bottom
  const slot = bars.length > 0 ? innerW / bars.length : 0
  const bw = Math.min(24, slot * 0.62)
  const sy = (v: number) => PAD.top + innerH - (v / top) * innerH
  const focus = active !== null ? bars[active] : undefined

  return (
    <div ref={ref} className="relative select-none" style={{ height }}>
      {width > 0 && (
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={label}
          className="block touch-pan-y"
        >
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={0}
                x2={innerW}
                y1={sy(t)}
                y2={sy(t)}
                stroke="var(--separator)"
                strokeWidth={1}
                shapeRendering="crispEdges"
              />
              <text
                x={width - 2}
                y={sy(t)}
                dy="0.32em"
                textAnchor="end"
                className="fill-label-2 text-caption-2 tabular"
              >
                {format(t)}
              </text>
            </g>
          ))}
          {bars.map((b, i) => {
            const x = i * slot + (slot - bw) / 2
            const y = sy(b.value)
            const isActive = active === i
            return (
              <g key={b.key}>
                <path
                  d={barPath(x, y, bw, PAD.top + innerH - y)}
                  fill={b.highlight || isActive ? 'var(--accent)' : 'var(--fill)'}
                />
                {b.highlight && b.value > 0 && (
                  <text
                    x={x + bw / 2}
                    y={y - 6}
                    textAnchor="middle"
                    className="fill-label text-caption font-semibold tabular"
                  >
                    {format(b.value)}
                  </text>
                )}
                {(i % Math.ceil(bars.length / 6) === 0 || i === bars.length - 1) && (
                  <text
                    x={i === 0 ? x : i === bars.length - 1 ? x + bw : x + bw / 2}
                    y={height - 6}
                    textAnchor={i === 0 ? 'start' : i === bars.length - 1 ? 'end' : 'middle'}
                    className="fill-label-2 text-caption-2 tabular"
                  >
                    {b.label}
                  </text>
                )}
                {/* Зона касания — весь слот, а не сам столбик. */}
                <rect
                  x={i * slot}
                  y={0}
                  width={slot}
                  height={height - PAD.bottom}
                  fill="transparent"
                  tabIndex={0}
                  aria-label={`${b.title}: ${format(b.value)}`}
                  onPointerDown={() => {
                    setActive(i)
                  }}
                  onPointerEnter={(e) => {
                    if (e.pointerType === 'mouse') setActive(i)
                  }}
                  onPointerLeave={() => {
                    setActive(null)
                  }}
                  onFocus={() => {
                    setActive(i)
                  }}
                  onBlur={() => {
                    setActive(null)
                  }}
                />
              </g>
            )
          })}
        </svg>
      )}
      {focus && active !== null && (
        <div
          className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 -translate-y-[calc(100%-6px)] rounded-xl bg-surface-2 px-2.5 py-1.5 text-center whitespace-nowrap shadow-[0_2px_12px_rgb(0_0_0/0.12)]"
          style={{ left: Math.min(Math.max(active * slot + slot / 2, 60), width - 60) }}
        >
          <div className="text-subhead font-semibold tabular">{format(focus.value)}</div>
          <div className="text-caption-2 text-label-2">{focus.title}</div>
        </div>
      )}
    </div>
  )
}
