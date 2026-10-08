const formatters = new Map<number, Intl.NumberFormat>()

function nf(maxFraction: number): Intl.NumberFormat {
  let f = formatters.get(maxFraction)
  if (!f) {
    f = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: maxFraction })
    formatters.set(maxFraction, f)
  }
  return f
}

/** Число по-русски: «62,5», «3 675». */
export function formatNumber(n: number, maxFraction = 2): string {
  return nf(maxFraction).format(n)
}

export function formatWeight(kg: number): string {
  return `${formatNumber(kg)} кг`
}

/** Объём: до 100 т в килограммах, дальше в тоннах. */
export function formatVolume(kg: number): string {
  if (kg >= 100_000) return `${formatNumber(kg / 1000, 1)} т`
  return `${formatNumber(Math.round(kg), 0)} кг`
}

/** Объём для плитки, где единица — в подписи: { value: '3 675', unit: 'кг' } или '125,4' т. */
export function volumeParts(kg: number): { value: string; unit: 'кг' | 'т' } {
  return kg >= 100_000
    ? { value: formatNumber(kg / 1000, 1), unit: 'т' }
    : { value: formatNumber(Math.round(kg), 0), unit: 'кг' }
}

export function formatDistance(km: number): string {
  return `${formatNumber(km, 2)} км`
}

const pad2 = (n: number) => String(n).padStart(2, '0')

/** Секундомер: «0:45», «32:15», «1:05:12». */
export function formatClock(totalSec: number): string {
  const sec = Math.max(0, Math.floor(totalSec))
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  return h > 0 ? `${h}:${pad2(m)}:${pad2(s)}` : `${m}:${pad2(s)}`
}

/** Длительность словами: «45 сек», «48 мин», «1 ч 5 мин». */
export function formatDuration(totalSec: number): string {
  const sec = Math.max(0, Math.round(totalSec))
  if (sec < 60) return `${sec} сек`
  const totalMin = Math.round(sec / 60)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h === 0) return `${m} мин`
  return m === 0 ? `${h} ч` : `${h} ч ${m} мин`
}

/** Время подхода в таблице: «1:30», «45 с» — компактнее, чем formatDuration. */
export function formatSetTime(totalSec: number): string {
  const sec = Math.max(0, Math.round(totalSec))
  if (sec < 60) return `${sec} с`
  return formatClock(sec)
}

/** Темп бега, секунды на километр → «5:20 /км». */
export function formatPace(secPerKm: number): string {
  return `${formatClock(secPerKm)} /км`
}

export function plural(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(n)
  const mod10 = abs % 10
  const mod100 = abs % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few
  return many
}

/** «3 подхода», «21 тренировка». */
export function countLabel(n: number, one: string, few: string, many: string): string {
  return `${formatNumber(n, 0)} ${plural(n, one, few, many)}`
}

/**
 * Разбор числа из ввода: принимает и запятую, и точку, пробелы внутри игнорирует.
 * Пустая строка и мусор → undefined.
 */
export function parseDecimal(input: string): number | undefined {
  const s = input.replace(/\s/g, '').replace(',', '.')
  if (s === '' || s === '.' || s === '-') return undefined
  if (!/^-?\d*\.?\d*$/.test(s)) return undefined
  const n = Number(s)
  return Number.isFinite(n) ? n : undefined
}

/** Округление до шага без хвостов плавающей точки: round(62.49, 0.5) → 62.5. */
export function roundTo(n: number, step: number): number {
  if (step <= 0) return n
  const decimals = (String(step).split('.')[1] ?? '').length
  return Number((Math.round(n / step) * step).toFixed(decimals))
}

/**
 * Длительность с цифровой клавиатуры iPhone, где нет двоеточия: последние две цифры —
 * секунды, остальное — минуты, как на микроволновке. «130» — 1:30, «1800» — 18:00,
 * «45» — 45 секунд. С двоеточием («1:30») — как написано.
 */
export function parseDurationInput(raw: string): number | undefined {
  const t = raw.trim()
  const colon = /^(\d{1,3}):(\d{1,2})$/.exec(t)
  if (colon) return Number(colon[1]) * 60 + Number(colon[2])
  if (!/^\d{1,5}$/.test(t)) return undefined
  const n = Number(t)
  return Math.floor(n / 100) * 60 + (n % 100)
}

/** Первая буква заглавная: «четверг, 8 октября» в начале строки — «Четверг, 8 октября». */
export function capitalize(s: string): string {
  return s.charAt(0).toLocaleUpperCase('ru-RU') + s.slice(1)
}
