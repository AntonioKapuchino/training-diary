/** «Круглые» деления оси: 0, 25, 50 … а не 0, 23,7, 47,4. */
export function niceTicks(min: number, max: number, count = 4): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return []
  if (min === max) {
    const pad = Math.abs(min) * 0.1 || 1
    min -= pad
    max += pad
  }
  const raw = (max - min) / Math.max(1, count)
  const pow = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? 10 * pow
  const start = Math.floor(min / step) * step
  const end = Math.ceil(max / step) * step
  const ticks: number[] = []
  for (let v = start; v <= end + step / 2; v += step) ticks.push(Number(v.toFixed(10)))
  return ticks
}

export interface Pt {
  x: number
  y: number
}

/**
 * Гладкая кривая без выбросов за точки (монотонная кубическая, Фриц — Карлсон):
 * линия не рисует «провалов», которых не было в данных.
 */
export function monotonePath(pts: readonly Pt[]): string {
  const n = pts.length
  if (n === 0) return ''
  const xs = pts.map((p) => p.x)
  const ys = pts.map((p) => p.y)
  const x = (i: number) => xs[i] ?? 0
  const y = (i: number) => ys[i] ?? 0
  const f = (v: number) => v.toFixed(1)
  if (n === 1) return `M${f(x(0))},${f(y(0))}`

  // Наклоны отрезков и касательные в точках.
  const m = Array.from({ length: n - 1 }, (_, i) =>
    x(i + 1) === x(i) ? 0 : (y(i + 1) - y(i)) / (x(i + 1) - x(i)),
  )
  const slope = (i: number) => m[i] ?? 0
  const t = Array.from({ length: n }, (_, i) => {
    if (i === 0) return slope(0)
    if (i === n - 1) return slope(n - 2)
    const m0 = slope(i - 1)
    const m1 = slope(i)
    return m0 * m1 <= 0 ? 0 : (m0 + m1) / 2
  })
  const tan = (i: number) => t[i] ?? 0
  for (let i = 0; i < n - 1; i++) {
    const mi = slope(i)
    if (mi === 0) {
      t[i] = 0
      t[i + 1] = 0
      continue
    }
    const a = tan(i) / mi
    const b = tan(i + 1) / mi
    const s = a * a + b * b
    if (s > 9) {
      const tau = 3 / Math.sqrt(s)
      t[i] = tau * a * mi
      t[i + 1] = tau * b * mi
    }
  }

  let d = `M${f(x(0))},${f(y(0))}`
  for (let i = 0; i < n - 1; i++) {
    const h = (x(i + 1) - x(i)) / 3
    if (h === 0) {
      d += `L${f(x(i + 1))},${f(y(i + 1))}`
      continue
    }
    d += `C${f(x(i) + h)},${f(y(i) + tan(i) * h)} ${f(x(i + 1) - h)},${f(y(i + 1) - tan(i + 1) * h)} ${f(x(i + 1))},${f(y(i + 1))}`
  }
  return d
}

/** Индекс ближайшей по x точки — для перекрестия. */
export function nearestIndex(xs: readonly number[], x: number): number {
  let best = 0
  let dist = Number.POSITIVE_INFINITY
  xs.forEach((v, i) => {
    const d = Math.abs(v - x)
    if (d < dist) {
      dist = d
      best = i
    }
  })
  return best
}
