import { useMemo } from 'react'
import { toISODate, todayISO, parseISO } from '../lib/date'

const MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']
const WEEKS = 18

interface Props {
  /** дата (YYYY-MM-DD) → силовой объём за день; наличие ключа = была тренировка */
  data: Map<string, number>
  onPick: (date: string) => void
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

export default function Heatmap({ data, onPick }: Props) {
  const { columns, maxVol, monthLabels } = useMemo(() => {
    const today = parseISO(todayISO())
    const todayIso = todayISO()
    const dow = (today.getDay() + 6) % 7 // 0 = понедельник
    const start = addDays(today, -dow - (WEEKS - 1) * 7)

    const maxVol = Math.max(1, ...Array.from(data.values()))
    const columns: { date: string; future: boolean; trained: boolean; vol: number }[][] = []
    const monthLabels: (string | null)[] = []
    let prevMonth = -1

    for (let w = 0; w < WEEKS; w++) {
      const col: { date: string; future: boolean; trained: boolean; vol: number }[] = []
      const firstDay = addDays(start, w * 7)
      const m = firstDay.getMonth()
      monthLabels.push(m !== prevMonth ? MONTHS_SHORT[m] : null)
      prevMonth = m
      for (let d = 0; d < 7; d++) {
        const date = toISODate(addDays(start, w * 7 + d))
        col.push({ date, future: date > todayIso, trained: data.has(date), vol: data.get(date) ?? 0 })
      }
      columns.push(col)
    }
    return { columns, maxVol, monthLabels }
  }, [data])

  function level(c: { trained: boolean; vol: number }): number {
    if (!c.trained) return 0
    const f = c.vol / maxVol
    if (c.vol === 0) return 1
    return f > 0.66 ? 3 : f > 0.33 ? 2 : 1
  }
  const opacity = [0, 0.4, 0.7, 1]

  return (
    <div className="heatmap">
      <div className="hm-months">
        {monthLabels.map((m, i) => <div key={i} className="hm-month">{m}</div>)}
      </div>
      <div className="hm-body">
        <div className="hm-weekdays">
          <span>Пн</span><span /><span>Ср</span><span /><span>Пт</span><span /><span />
        </div>
        <div className="hm-grid">
          {columns.map((col, i) => (
            <div key={i} className="hm-col">
              {col.map((c) => (
                <button
                  key={c.date}
                  className="hm-cell"
                  disabled={c.future || !c.trained}
                  onClick={() => c.trained && onPick(c.date)}
                  style={{
                    background: c.future ? 'transparent' : c.trained ? 'var(--accent)' : 'var(--surface-2)',
                    opacity: c.future ? 0 : c.trained ? opacity[level(c)] : 1,
                    border: c.trained || c.future ? 'none' : '1px solid var(--border)',
                  }}
                  title={c.trained ? `${c.date}${c.vol ? ` · ${Math.round(c.vol)} кг` : ''}` : c.date}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
