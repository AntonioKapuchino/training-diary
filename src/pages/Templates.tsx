import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { applyTemplate, deleteTemplate } from '../db/store'
import type { Template } from '../db/types'
import { GROUP_COLOR } from '../lib/groupColor'
import { todayISO, formatDayYear } from '../lib/date'
import { IconTemplate, IconTrash, IconPlus } from '../components/icons'
import Sheet from '../components/Sheet'

export default function Templates() {
  const nav = useNavigate()
  // по дате создания: старые сверху, новые снизу
  const templates = useLiveQuery(() => db.templates.orderBy('createdAt').toArray(), [])
  const [apply, setApply] = useState<Template | null>(null)
  const [date, setDate] = useState(todayISO())

  async function handleApply() {
    if (!apply) return
    await applyTemplate(apply, date)
    setApply(null)
    nav(`/workout/${date}`)
  }

  return (
    <div className="screen">
      <div className="screen-header">
        <div className="screen-title">Шаблоны</div>
        <div className="screen-sub">Повтори тренировку в один тап</div>
      </div>

      {templates && templates.length === 0 && (
        <div className="empty">
          <div className="em-icon"><IconTemplate /></div>
          <h3>Нет шаблонов</h3>
          <p>Открой любую тренировку и нажми «Сохранить как шаблон» — она появится здесь.</p>
        </div>
      )}

      {(templates ?? []).map((t) => {
        const groups = Array.from(new Set(t.exercises.map((e) => e.group)))
        return (
          <div key={t.id} className="card">
            <div className="row" style={{ marginBottom: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 750, fontSize: 17 }}>{t.name}</div>
                <div className="tiny muted" style={{ display: 'flex', gap: 5, alignItems: 'center', marginTop: 4 }}>
                  {groups.map((g) => <span key={g} className="group-dot" style={{ background: GROUP_COLOR[g] }} />)}
                  {t.exercises.length} упр.
                </div>
              </div>
              <button className="icon-btn" style={{ color: 'var(--text-3)' }} onClick={() => deleteTemplate(t.id!)}>
                <IconTrash style={{ width: 18, height: 18 }} />
              </button>
            </div>

            <div className="tiny muted" style={{ lineHeight: 1.7, marginBottom: 12 }}>
              {t.exercises.map((e) => e.exerciseName).join(' · ')}
            </div>

            <button className="btn sm secondary" onClick={() => { setDate(todayISO()); setApply(t) }}>
              <IconPlus style={{ width: 16, height: 16 }} /> Применить
            </button>
          </div>
        )
      })}

      <Sheet open={!!apply} onClose={() => setApply(null)} title="Применить шаблон">
        <p className="muted" style={{ marginBottom: 16 }}>
          Добавим упражнения из «{apply?.name}» в тренировку на выбранную дату.
        </p>
        <label className="section-label" style={{ margin: '0 0 8px' }}>Дата</label>
        <input type="date" className="field" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} />
        <button className="btn" style={{ marginTop: 18 }} onClick={handleApply}>
          Добавить в тренировку {formatDayYear(date)}
        </button>
      </Sheet>
    </div>
  )
}
