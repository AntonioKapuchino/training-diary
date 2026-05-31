import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { exerciseProgress } from '../db/store'
import type { ProgressPoint } from '../db/types'
import { GROUP_COLOR } from '../lib/groupColor'
import { formatShort } from '../lib/date'
import { progMetrics, historyLine, plural } from '../lib/exerciseKind'
import { IconChart, IconChevron, IconFlame } from '../components/icons'
import LineChart, { type ChartPoint } from '../components/LineChart'

export default function Progress() {
  const [selected, setSelected] = useState<number | null>(null)
  const [metricIdx, setMetricIdx] = useState(0)
  const [points, setPoints] = useState<ProgressPoint[]>([])

  const exercises = useLiveQuery(() => db.exercises.toArray(), [])
  const entries = useLiveQuery(() => db.entries.toArray(), [])

  const withHistory = useMemo(() => {
    const ids = new Set((entries ?? []).map((e) => e.exerciseId))
    const counts = new Map<number, number>()
    for (const e of entries ?? []) counts.set(e.exerciseId, (counts.get(e.exerciseId) ?? 0) + 1)
    return (exercises ?? [])
      .filter((ex) => ids.has(ex.id!))
      .map((ex) => ({ ...ex, count: counts.get(ex.id!) ?? 0 }))
      .sort((a, b) => b.count - a.count)
  }, [exercises, entries])

  useEffect(() => {
    if (selected == null) { setPoints([]); return }
    setMetricIdx(0)
    exerciseProgress(selected).then(setPoints)
  }, [selected, entries])

  const current = withHistory.find((e) => e.id === selected)
  const metrics = current ? progMetrics(current.kind ?? 'strength') : []
  const metric = metrics[metricIdx] ?? metrics[0]

  const chartData: ChartPoint[] = metric
    ? points.map((p) => ({ label: formatShort(p.date), value: metric.value(p) }))
    : []

  const record = metric ? points.reduce((m, p) => Math.max(m, metric.value(p)), 0) : 0
  const lastVal = metric && points.length ? metric.value(points[points.length - 1]) : 0
  const firstVal = metric && points.length ? metric.value(points[0]) : 0
  const delta = lastVal - firstVal

  return (
    <div className="screen">
      <div className="screen-header">
        <div className="screen-title">Прогресс</div>
        <div className="screen-sub">Динамика по упражнениям</div>
      </div>

      {withHistory.length === 0 && (
        <div className="empty">
          <div className="em-icon"><IconChart /></div>
          <h3>Нет данных</h3>
          <p>Запиши пару тренировок — здесь появятся графики прогресса.</p>
        </div>
      )}

      {!selected && withHistory.length > 0 && (
        <>
          <div className="section-label">Выбери упражнение</div>
          <div className="card" style={{ padding: '4px 16px' }}>
            {withHistory.map((ex) => (
              <div key={ex.id} className="list-item tappable" onClick={() => setSelected(ex.id!)}>
                <span className="group-dot" style={{ background: GROUP_COLOR[ex.group], width: 11, height: 11 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>{ex.name}</div>
                  <div className="tiny muted">{ex.count} {plural(ex.count, 'тренировка', 'тренировки', 'тренировок')}</div>
                </div>
                <IconChevron style={{ color: 'var(--text-3)', width: 18, height: 18 }} />
              </div>
            ))}
          </div>
        </>
      )}

      {selected && current && metric && (
        <>
          <button className="btn sm ghost" style={{ marginBottom: 14 }} onClick={() => setSelected(null)}>← Все упражнения</button>

          <div className="row" style={{ marginBottom: 14 }}>
            <span className="group-dot" style={{ background: GROUP_COLOR[current.group], width: 13, height: 13 }} />
            <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em' }}>{current.name}</div>
          </div>

          <div className="stat-grid">
            <div className="stat">
              <div className="v" style={{ fontSize: 20 }}>{metric.format(record)}</div>
              <div className="l">рекорд</div>
            </div>
            <div className="stat">
              <div className="v" style={{ fontSize: 20 }}>{metric.format(lastVal)}</div>
              <div className="l">последний</div>
            </div>
            <div className="stat">
              <div className="v" style={{ fontSize: 20, color: delta > 0 ? 'var(--success)' : delta < 0 ? 'var(--danger)' : undefined }}>
                {delta > 0 ? '+' : delta < 0 ? '−' : ''}{metric.format(Math.abs(delta))}
              </div>
              <div className="l">с начала</div>
            </div>
          </div>

          <div className="card" style={{ marginTop: 14 }}>
            <div className="chips-row" style={{ marginBottom: 6 }}>
              {metrics.map((m, i) => (
                <button key={m.key} className={'chip' + (metricIdx === i ? ' active' : '')} onClick={() => setMetricIdx(i)}>{m.label}</button>
              ))}
            </div>
            {points.length < 2 ? (
              <p className="muted center" style={{ padding: '30px 10px' }}>
                Нужно минимум 2 тренировки с этим упражнением, чтобы построить график.
              </p>
            ) : (
              <LineChart data={chartData} color={GROUP_COLOR[current.group]} />
            )}
          </div>

          <div className="section-label">История</div>
          {[...points].reverse().map((p, i) => (
            <div key={i} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700 }}>{formatShort(p.date)}</div>
                <div className="tiny muted">{historyLine(current.kind ?? 'strength', p)}</div>
              </div>
              {metric.value(p) === record && record > 0 && (
                <span style={{ color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 3, fontWeight: 700, fontSize: 13 }}>
                  <IconFlame style={{ width: 16, height: 16 }} /> PR
                </span>
              )}
            </div>
          ))}
        </>
      )}
    </div>
  )
}
