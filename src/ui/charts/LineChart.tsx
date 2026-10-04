import { motion } from 'motion/react'
import { useId, useMemo, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { monotonePath, nearestIndex, niceTicks } from './geometry'
import { useMeasure } from './useMeasure'

export interface LinePoint {
  x: number
  y: number
}

interface Props {
  points: readonly LinePoint[]
  /** Цвет линии — CSS-значение, обычно var(--m-…) или var(--accent). */
  color: string
  formatY: (v: number) => string
  /** Подпись даты в подсказке. */
  formatX: (x: number) => string
  /** Короткая подпись даты на оси. */
  axisX: (x: number) => string
  height?: number
  label: string
}

const PAD = { top: 12, right: 44, bottom: 24, left: 4 }

/**
 * Линия по времени: ось x — настоящие даты, перерыв в тренировках виден как пауза.
 * Ведёшь пальцем — перекрестие цепляется за ближайшую тренировку.
 */
export function LineChart({ points, color, formatY, formatX, axisX, height = 200, label }: Props) {
  const [ref, width] = useMeasure<HTMLDivElement>()
  const [active, setActive] = useState<number | null>(null)
  const gradId = useId()

  const geo = useMemo(() => {
    if (width === 0 || points.length === 0) return null
    const xs = points.map((p) => p.x)
    const ys = points.map((p) => p.y)
    const minX = Math.min(...xs)
    const maxX = Math.max(...xs)
    const ticks = niceTicks(Math.min(...ys), Math.max(...ys), 3)
    const lo = ticks[0] ?? 0
    const hi = ticks.at(-1) ?? 1
    const innerW = width - PAD.left - PAD.right
    const innerH = height - PAD.top - PAD.bottom
    const sx = (x: number) =>
      maxX === minX ? PAD.left + innerW / 2 : PAD.left + ((x - minX) / (maxX - minX)) * innerW
    const sy = (y: number) => PAD.top + innerH - ((y - lo) / (hi - lo || 1)) * innerH
    const mapped = points.map((p) => ({ x: sx(p.x), y: sy(p.y) }))
    const line = monotonePath(mapped)
    const base = PAD.top + innerH
    const firstPt = mapped[0]
    const lastPt = mapped.at(-1)
    const area =
      firstPt && lastPt && mapped.length > 1
        ? `${line}L${lastPt.x.toFixed(1)},${base}L${firstPt.x.toFixed(1)},${base}Z`
        : ''
    const xTicks = maxX === minX ? [minX] : [minX, minX + (maxX - minX) / 2, maxX]
    return { mapped, line, area, ticks, sy, sx, base, xTicks, innerW }
  }, [points, width, height])

  function pick(e: PointerEvent<SVGRectElement>) {
    if (!geo) return
    const box = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - box.left + PAD.left
    setActive(
      nearestIndex(
        geo.mapped.map((p) => p.x),
        x,
      ),
    )
  }

  function onKey(e: KeyboardEvent<SVGSVGElement>) {
    if (points.length === 0) return
    if (e.key === 'ArrowLeft') setActive((a) => Math.max(0, (a ?? points.length) - 1))
    else if (e.key === 'ArrowRight') setActive((a) => Math.min(points.length - 1, (a ?? -1) + 1))
    else if (e.key === 'Escape') setActive(null)
  }

  const shown = active ?? null
  const activePt = shown !== null ? geo?.mapped[shown] : undefined
  const activeData = shown !== null ? points[shown] : undefined
  const last = geo?.mapped.at(-1)
  const lastData = points.at(-1)

  return (
    <div ref={ref} className="relative select-none" style={{ height }}>
      {geo && (
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={label}
          tabIndex={0}
          onKeyDown={onKey}
          onBlur={() => {
            setActive(null)
          }}
          className="block touch-pan-y overflow-visible outline-none"
        >
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.18} />
              <stop offset="100%" stopColor={color} stopOpacity={0.02} />
            </linearGradient>
          </defs>

          {geo.ticks.map((t) => (
            <g key={t}>
              <line
                x1={PAD.left}
                x2={width - PAD.right + 6}
                y1={geo.sy(t)}
                y2={geo.sy(t)}
                stroke="var(--separator)"
                strokeWidth={1}
                shapeRendering="crispEdges"
              />
              <text
                x={width - 2}
                y={geo.sy(t)}
                dy="0.32em"
                textAnchor="end"
                className="fill-label-2 text-caption-2 tabular"
              >
                {formatY(t)}
              </text>
            </g>
          ))}

          {geo.xTicks.map((x, i) => (
            <text
              key={x}
              x={geo.sx(x)}
              y={height - 6}
              textAnchor={
                geo.xTicks.length === 1
                  ? 'middle'
                  : i === 0
                    ? 'start'
                    : i === geo.xTicks.length - 1
                      ? 'end'
                      : 'middle'
              }
              className="fill-label-2 text-caption-2 tabular"
            >
              {axisX(x)}
            </text>
          ))}

          {geo.area && <path d={geo.area} fill={`url(#${gradId})`} />}
          <motion.path
            key={`${points.length}-${points[0]?.x ?? 0}`}
            d={geo.line}
            fill="none"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.7, ease: [0.32, 0.72, 0, 1] }}
          />

          {activePt && (
            <line
              x1={activePt.x}
              x2={activePt.x}
              y1={PAD.top - 8}
              y2={geo.base}
              stroke="var(--label-3)"
              strokeWidth={1}
            />
          )}

          {(activePt ?? last) && (
            <circle
              cx={(activePt ?? last)?.x}
              cy={(activePt ?? last)?.y}
              r={4.5}
              fill={color}
              stroke="var(--surface)"
              strokeWidth={2}
            />
          )}

          {/* Попадание пальцем — по всей площади графика, не по линии. */}
          <rect
            x={PAD.left}
            y={0}
            width={geo.innerW}
            height={height - PAD.bottom}
            fill="transparent"
            onPointerDown={pick}
            onPointerMove={(e) => {
              if (e.pointerType === 'mouse' || e.buttons > 0) pick(e)
            }}
            onPointerLeave={() => {
              setActive(null)
            }}
            onPointerUp={(e) => {
              if (e.pointerType !== 'mouse') setActive(null)
            }}
          />
        </svg>
      )}

      {activePt && activeData && (
        <div
          className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 -translate-y-[calc(100%+4px)] rounded-xl bg-surface-2 px-2.5 py-1.5 text-center whitespace-nowrap shadow-[0_2px_12px_rgb(0_0_0/0.12)]"
          style={{ left: Math.min(Math.max(activePt.x, 56), width - 56) }}
        >
          <div className="text-subhead font-semibold tabular">{formatY(activeData.y)}</div>
          <div className="text-caption-2 text-label-2">{formatX(activeData.x)}</div>
        </div>
      )}
      {!activePt && last && lastData && points.length > 1 && (
        <span className="sr-only">
          Последнее значение: {formatY(lastData.y)}, {formatX(lastData.x)}
        </span>
      )}
    </div>
  )
}
