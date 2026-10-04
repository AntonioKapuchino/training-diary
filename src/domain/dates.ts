import { plural } from './format'

const DAY_MS = 86_400_000

const pad2 = (n: number) => String(n).padStart(2, '0')

/** Локальная дата YYYY-MM-DD, без сдвига по часовому поясу. */
export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

export function todayISO(now: Date = new Date()): string {
  return toISODate(now)
}

export function isISODate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const d = parseISODate(s)
  return toISODate(d) === s
}

/** Полночь по местному времени. */
export function parseISODate(iso: string): Date {
  const [y = 1970, m = 1, d = 1] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function dateOf(ms: number): string {
  return toISODate(new Date(ms))
}

export function addDays(iso: string, n: number): string {
  const d = parseISODate(iso)
  d.setDate(d.getDate() + n)
  return toISODate(d)
}

/** Разница в днях b − a; переход на летнее время не ломает счёт. */
export function daysBetween(a: string, b: string): number {
  return Math.round((parseISODate(b).getTime() - parseISODate(a).getTime()) / DAY_MS)
}

/** Понедельник недели, в которую входит дата. */
export function startOfWeek(iso: string): string {
  const d = parseISODate(iso)
  const dow = (d.getDay() + 6) % 7
  return addDays(iso, -dow)
}

export function weekDays(iso: string): string[] {
  const monday = startOfWeek(iso)
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i))
}

export function startOfMonth(iso: string): string {
  return `${iso.slice(0, 7)}-01`
}

export function addMonths(iso: string, n: number): string {
  const d = parseISODate(startOfMonth(iso))
  d.setMonth(d.getMonth() + n)
  return toISODate(d)
}

export const WEEKDAY_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'] as const

const fmtDayMonth = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' })
const fmtDayMonthYear = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})
const fmtDayMonthShort = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' })
const fmtWeekday = new Intl.DateTimeFormat('ru-RU', { weekday: 'long' })
const fmtWeekdayShort = new Intl.DateTimeFormat('ru-RU', { weekday: 'short' })
const fmtMonth = new Intl.DateTimeFormat('ru-RU', { month: 'long' })
const fmtTime = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' })

const sameYear = (iso: string, today: string) => iso.slice(0, 4) === today.slice(0, 4)

/** «4 октября», для прошлых лет — «4 октября 2025 г.». */
export function formatDayMonth(iso: string, today = todayISO()): string {
  const d = parseISODate(iso)
  return sameYear(iso, today) ? fmtDayMonth.format(d) : fmtDayMonthYear.format(d)
}

/** «4 окт.» — для осей графиков и плотных списков. */
export function formatDayMonthShort(iso: string): string {
  return fmtDayMonthShort.format(parseISODate(iso))
}

/** «суббота, 4 октября». */
export function formatWeekdayDayMonth(iso: string, today = todayISO()): string {
  return `${fmtWeekday.format(parseISODate(iso))}, ${formatDayMonth(iso, today)}`
}

/** «сб». Регистр приводим сами: в Safari и Node он разный. */
export function formatWeekdayShort(iso: string): string {
  return fmtWeekdayShort.format(parseISODate(iso)).toLowerCase()
}

/** «Сегодня», «Вчера», иначе «сб, 4 октября». */
export function formatRelativeDay(iso: string, today = todayISO()): string {
  const diff = daysBetween(iso, today)
  if (diff === 0) return 'Сегодня'
  if (diff === 1) return 'Вчера'
  const s = `${formatWeekdayShort(iso).toLowerCase()}, ${formatDayMonth(iso, today)}`
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** «3 дня назад», «2 недели назад» — для «последний раз». */
export function formatAgo(iso: string, today = todayISO()): string {
  const diff = daysBetween(iso, today)
  if (diff <= 0) return 'сегодня'
  if (diff === 1) return 'вчера'
  if (diff < 7) return `${diff} ${dayWord(diff)} назад`
  if (diff < 30) {
    const w = Math.floor(diff / 7)
    return w === 1 ? 'неделю назад' : `${w} ${weekWord(w)} назад`
  }
  if (diff < 365) {
    const m = Math.floor(diff / 30)
    return m === 1 ? 'месяц назад' : `${m} ${monthWord(m)} назад`
  }
  return formatDayMonth(iso, today)
}

function dayWord(n: number) {
  return plural(n, 'день', 'дня', 'дней')
}
function weekWord(n: number) {
  return plural(n, 'неделю', 'недели', 'недель')
}
function monthWord(n: number) {
  return plural(n, 'месяц', 'месяца', 'месяцев')
}

/** «Октябрь 2026», для текущего года — просто «Октябрь». */
export function formatMonthYear(iso: string, today = todayISO()): string {
  const name = fmtMonth.format(parseISODate(iso))
  const cap = name.charAt(0).toUpperCase() + name.slice(1)
  return sameYear(iso, today) ? cap : `${cap} ${iso.slice(0, 4)}`
}

/** «18:42». */
export function formatTime(ms: number): string {
  return fmtTime.format(new Date(ms))
}

/** Отметка времени для даты и времени «HH:MM» по местному часовому поясу. */
export function combineDateTime(iso: string, hhmm: string): number {
  const d = parseISODate(iso)
  const [h = 0, m = 0] = hhmm.split(':').map(Number)
  d.setHours(h, m, 0, 0)
  return d.getTime()
}

/** «HH:MM» для поля ввода времени. */
export function toTimeInput(ms: number): string {
  const d = new Date(ms)
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}
