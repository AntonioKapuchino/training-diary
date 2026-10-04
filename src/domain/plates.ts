/** Стандартный набор блинов в зале, кг. */
export const DEFAULT_PLATES: readonly number[] = [25, 20, 15, 10, 5, 2.5, 1.25]

export interface PlateResult {
  /** Блины на одну сторону, от тяжёлых к лёгким. */
  perSide: number[]
  /** Сколько реально наберётся этими блинами. */
  total: number
  /** Сколько не хватило до нужного веса (на обе стороны). */
  missing: number
}

const EPS = 1e-6

/** Раскладка блинов на гриф. null — вес меньше грифа. */
export function platesFor(
  target: number,
  bar: number,
  plates: readonly number[] = DEFAULT_PLATES,
): PlateResult | null {
  if (target < bar - EPS) return null
  let side = (target - bar) / 2
  const perSide: number[] = []
  for (const p of [...plates].sort((a, b) => b - a)) {
    while (p > 0 && side >= p - EPS) {
      perSide.push(p)
      side -= p
    }
  }
  const loaded = perSide.reduce((a, b) => a + b, 0) * 2
  const total = Number((bar + loaded).toFixed(3))
  return { perSide, total, missing: Number((target - total).toFixed(3)) }
}
