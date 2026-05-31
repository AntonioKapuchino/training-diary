const MONTHS = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
]
const MONTHS_SHORT = [
  'янв', 'фев', 'мар', 'апр', 'мая', 'июн',
  'июл', 'авг', 'сен', 'окт', 'ноя', 'дек',
]
const WEEKDAYS = [
  'воскресенье', 'понедельник', 'вторник', 'среда',
  'четверг', 'пятница', 'суббота',
]
const WEEKDAYS_SHORT = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб']

/** Локальная дата в формате YYYY-MM-DD (без сдвига по часовому поясу) */
export function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function todayISO(): string {
  return toISODate(new Date())
}

export function parseISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** «11 мая 2026, понедельник» */
export function formatFull(iso: string): string {
  const d = parseISO(iso)
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${WEEKDAYS[d.getDay()]}`
}

/** «11 мая» */
export function formatDay(iso: string): string {
  const d = parseISO(iso)
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`
}

/** «11 мая 2026» */
export function formatDayYear(iso: string): string {
  const d = parseISO(iso)
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

/** короткая: «11 мая» для оси графика */
export function formatShort(iso: string): string {
  const d = parseISO(iso)
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`
}

export function weekdayShort(iso: string): string {
  return WEEKDAYS_SHORT[parseISO(iso).getDay()]
}

export function isToday(iso: string): boolean {
  return iso === todayISO()
}

export function relativeLabel(iso: string): string {
  const today = todayISO()
  if (iso === today) return 'Сегодня'
  const d = parseISO(iso)
  const t = parseISO(today)
  const diff = Math.round((t.getTime() - d.getTime()) / 86400000)
  if (diff === 1) return 'Вчера'
  if (diff === -1) return 'Завтра'
  return ''
}

export { MONTHS, WEEKDAYS, WEEKDAYS_SHORT }
