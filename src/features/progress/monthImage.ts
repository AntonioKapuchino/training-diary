import { addMonths, monthPrepositional } from '@/domain/dates'
import { formatDuration, formatNumber, formatVolume, plural } from '@/domain/format'
import { MUSCLE_LABEL } from '@/domain/labels'
import type { MonthReport } from '@/domain/month'

const W = 1080
const H = 1350
const PAD = 72
const FONT = 'ui-rounded, -apple-system, BlinkMacSystemFont, system-ui, sans-serif'
const TEXT = '-apple-system, BlinkMacSystemFont, system-ui, sans-serif'

/** Цвет из темы приложения — картинка в тех же цветах, что и экран. */
function token(name: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return v === '' ? fallback : v
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
  ctx.fill()
}

/** Текст, ужатый до ширины многоточием. */
function fitText(ctx: CanvasRenderingContext2D, text: string, max: number): string {
  if (ctx.measureText(text).width <= max) return text
  let s = text
  while (s.length > 1 && ctx.measureText(`${s}…`).width > max) s = s.slice(0, -1)
  return `${s.trimEnd()}…`
}

/**
 * Картинка с итогами месяца 1080 × 1350 — для «Поделиться»: месяц, число тренировок,
 * время, объём, подходы, рекорды и главные группы мышц.
 */
export async function monthImage(report: MonthReport, title: string): Promise<File> {
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas недоступен')

  const bg = token('--bg', '#f2f2f7')
  const surface = token('--surface', '#ffffff')
  const label = token('--label', '#000000')
  const label2 = token('--label-2', 'rgba(60,60,67,0.62)')
  const accent = token('--accent', '#5856d6')
  const success = token('--success', '#34c759')
  const fill = token('--fill-3', 'rgba(118,118,128,0.12)')

  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)
  // Мягкое свечение акцентом сверху — как шапка карточки.
  const glow = ctx.createRadialGradient(W * 0.85, -80, 40, W * 0.85, -80, 720)
  glow.addColorStop(0, accent)
  glow.addColorStop(1, 'transparent')
  ctx.globalAlpha = 0.28
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, W, 720)
  ctx.globalAlpha = 1
  ctx.textBaseline = 'alphabetic'

  ctx.fillStyle = accent
  ctx.font = `600 34px ${TEXT}`
  ctx.fillText('ИТОГИ МЕСЯЦА', PAD, 130)
  ctx.fillStyle = label
  ctx.font = `700 84px ${TEXT}`
  ctx.fillText(fitText(ctx, title, W - PAD * 2), PAD, 228)

  // Главная цифра.
  const n = report.totals.workouts
  ctx.font = `700 200px ${FONT}`
  const numW = ctx.measureText(String(n)).width
  ctx.fillText(String(n), PAD - 6, 446)
  ctx.font = `600 52px ${TEXT}`
  ctx.fillText(plural(n, 'тренировка', 'тренировки', 'тренировок'), PAD + numW + 18, 446)
  const before = report.previous.workouts
  const diff = n - before
  const prev = monthPrepositional(addMonths(report.month, -1))
  ctx.font = `500 36px ${TEXT}`
  ctx.fillStyle = diff > 0 && before > 0 ? success : label2
  ctx.fillText(
    before === 0
      ? `в ${prev} не было ни одной`
      : diff === 0
        ? `столько же, сколько в ${prev}`
        : `на ${formatNumber(Math.abs(diff), 0)} ${diff > 0 ? 'больше' : 'меньше'}, чем в ${prev}`,
    PAD,
    506,
  )

  // Четыре плитки.
  const tiles = [
    ['Время', report.totals.seconds > 0 ? formatDuration(report.totals.seconds) : '—'],
    ['Объём', report.totals.volume > 0 ? formatVolume(report.totals.volume) : '—'],
    ['Подходы', String(report.totals.sets)],
    ['Рекорды', String(report.totals.records)],
  ] as const
  const gap = 24
  const tw = (W - PAD * 2 - gap) / 2
  const th = 170
  tiles.forEach(([name, value], i) => {
    const x = PAD + (i % 2) * (tw + gap)
    const y = 570 + Math.floor(i / 2) * (th + gap)
    ctx.fillStyle = surface
    roundRect(ctx, x, y, tw, th, 36)
    ctx.fillStyle = label2
    ctx.font = `500 32px ${TEXT}`
    ctx.fillText(name, x + 36, y + 60)
    ctx.fillStyle =
      name === 'Рекорды' && report.totals.records > 0 ? token('--warning', '#ff9500') : label
    ctx.font = `700 60px ${FONT}`
    ctx.fillText(fitText(ctx, value, tw - 72), x + 36, y + 136)
  })

  // Группы мышц — до четырёх, цветом группы: пятая уже налезала бы на подпись внизу.
  const muscles = report.muscles.slice(0, 4)
  const top = 570 + 2 * (th + gap) + 34
  ctx.fillStyle = label
  ctx.font = `600 36px ${TEXT}`
  ctx.fillText('Группы мышц', PAD, top + 40)
  const max = Math.max(1, ...muscles.map((m) => m.sets))
  const barX = PAD + 210
  const barW = W - PAD * 2 - 210 - 90
  muscles.forEach((m, i) => {
    const y = top + 84 + i * 56
    ctx.fillStyle = label
    ctx.font = `500 32px ${TEXT}`
    ctx.fillText(MUSCLE_LABEL[m.muscle], PAD, y + 11)
    ctx.fillStyle = fill
    roundRect(ctx, barX, y - 12, barW, 26, 13)
    ctx.fillStyle = token(`--m-${m.muscle}`, accent)
    roundRect(ctx, barX, y - 12, Math.max(26, (barW * m.sets) / max), 26, 13)
    ctx.fillStyle = label
    ctx.font = `600 32px ${FONT}`
    ctx.textAlign = 'right'
    ctx.fillText(String(m.sets), W - PAD, y + 11)
    ctx.textAlign = 'left'
  })

  ctx.fillStyle = label2
  ctx.font = `500 28px ${TEXT}`
  ctx.fillText('Дневник тренировок', PAD, H - 44)

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/png')
  })
  if (!blob) throw new Error('Не удалось сохранить картинку')
  return new File([blob], `итоги-${report.month.slice(0, 7)}.png`, { type: 'image/png' })
}
