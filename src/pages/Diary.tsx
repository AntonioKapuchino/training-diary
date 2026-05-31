import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { getOrCreateWorkout } from '../db/store'
import { downloadBackup, restoreBackup, type ImportSummary } from '../db/backup'
import { THEMES, getStoredTheme, setTheme, type Theme } from '../lib/theme'
import { strengthVolume } from '../lib/exerciseKind'
import { formatDayYear, relativeLabel, weekdayShort, todayISO, parseISO } from '../lib/date'
import { GROUP_COLOR } from '../lib/groupColor'
import { IconPlus, IconChevron, IconCalendar, IconSettings, IconDownload, IconUpload } from '../components/icons'
import Sheet from '../components/Sheet'
import Heatmap from '../components/Heatmap'

export default function Diary() {
  const nav = useNavigate()
  const [pickOpen, setPickOpen] = useState(false)
  const [pickDate, setPickDate] = useState(todayISO())
  const [dataOpen, setDataOpen] = useState(false)
  const [importInfo, setImportInfo] = useState<ImportSummary | null>(null)
  const [importErr, setImportErr] = useState('')
  const [theme, setThemeState] = useState<Theme>(getStoredTheme())
  const fileRef = useRef<HTMLInputElement>(null)

  function changeTheme(t: Theme) {
    setTheme(t)
    setThemeState(t)
  }

  const workouts = useLiveQuery(() => db.workouts.orderBy('date').reverse().toArray(), [])
  const entries = useLiveQuery(() => db.entries.toArray(), [])

  const byWorkout = useMemo(() => {
    const map = new Map<number, typeof entries>()
    for (const e of entries ?? []) {
      const arr = map.get(e.workoutId) ?? []
      arr!.push(e)
      map.set(e.workoutId, arr)
    }
    return map
  }, [entries])

  const heatData = useMemo(() => {
    const map = new Map<string, number>()
    for (const w of workouts ?? []) {
      const list = byWorkout.get(w.id!) ?? []
      const vol = list.reduce((s, e) => s + strengthVolume(e.kind, e.sets), 0)
      map.set(w.date, vol)
    }
    return map
  }, [workouts, byWorkout])

  const stats = useMemo(() => {
    const list = workouts ?? []
    const now = parseISO(todayISO())
    const monthCount = list.filter((w) => {
      const d = parseISO(w.date)
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
    }).length
    return { total: list.length, month: monthCount }
  }, [workouts])

  async function openDate(date: string) {
    await getOrCreateWorkout(date)
    setPickOpen(false)
    nav(`/workout/${date}`)
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setImportErr('')
    setImportInfo(null)
    try {
      const text = await file.text()
      const summary = await restoreBackup(text)
      setImportInfo(summary)
    } catch (err) {
      setImportErr(err instanceof Error ? err.message : 'Не удалось прочитать файл')
    }
  }

  const loading = workouts === undefined || entries === undefined

  return (
    <div className="screen">
      <div className="screen-header" style={{ display: 'flex', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <div className="screen-title">Дневник</div>
          <div className="screen-sub">Тренировки и прогресс</div>
        </div>
        <button className="icon-btn" title="Данные и бэкап" onClick={() => { setImportInfo(null); setImportErr(''); setDataOpen(true) }} style={{ marginTop: 16 }}>
          <IconSettings />
        </button>
      </div>

      <div className="stat-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="stat">
          <div className="v">{stats.total}</div>
          <div className="l">всего тренировок</div>
        </div>
        <div className="stat">
          <div className="v">{stats.month}</div>
          <div className="l">в этом месяце</div>
        </div>
      </div>

      {(workouts?.length ?? 0) > 0 && (
        <>
          <div className="section-label">Активность</div>
          <div className="card">
            <Heatmap data={heatData} onPick={(d) => nav(`/workout/${d}`)} />
          </div>
        </>
      )}

      <div className="section-label">История</div>

      {!loading && (workouts?.length ?? 0) === 0 && (
        <div className="empty">
          <div className="em-icon"><IconCalendar /></div>
          <h3>Пока пусто</h3>
          <p>Добавь первую тренировку — нажми кнопку ниже.</p>
        </div>
      )}

      {(workouts ?? []).map((w) => {
        const list = byWorkout.get(w.id!) ?? []
        const totalVol = list.reduce((s, e) => s + strengthVolume(e.kind, e.sets), 0)
        const groups = Array.from(new Set(list.map((e) => e.group)))
        const rel = relativeLabel(w.date)
        return (
          <div
            key={w.id}
            className="card tappable"
            onClick={() => nav(`/workout/${w.date}`)}
            style={{ display: 'flex', alignItems: 'center', gap: 14 }}
          >
            <div style={{ textAlign: 'center', minWidth: 46 }}>
              <div style={{ fontSize: 26, fontWeight: 800, lineHeight: 1 }}>{parseISO(w.date).getDate()}</div>
              <div className="tiny muted" style={{ textTransform: 'uppercase', fontWeight: 700 }}>{weekdayShort(w.date)}</div>
            </div>
            <div className="divider" style={{ width: 1, height: 42, margin: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>
                {rel || formatDayYear(w.date)}
              </div>
              <div className="tiny muted" style={{ marginTop: 4, display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
                {list.length === 0 ? (
                  <span>нет упражнений</span>
                ) : (
                  <>
                    {groups.slice(0, 4).map((g) => (
                      <span key={g} className="group-dot" style={{ background: GROUP_COLOR[g] }} />
                    ))}
                    <span>{list.length} упр.</span>
                    {totalVol > 0 && <span>· {Math.round(totalVol).toLocaleString('ru')} кг объём</span>}
                  </>
                )}
              </div>
            </div>
            <IconChevron style={{ color: 'var(--text-3)', width: 20, height: 20 }} />
          </div>
        )
      })}

      <button className="fab" onClick={() => { setPickDate(todayISO()); setPickOpen(true) }}>
        <IconPlus style={{ width: 22, height: 22 }} /> Новая тренировка
      </button>

      <Sheet open={pickOpen} onClose={() => setPickOpen(false)} title="Новая тренировка">
        <p className="muted" style={{ marginBottom: 16 }}>Выбери день, когда была тренировка.</p>
        <label className="section-label" style={{ margin: '0 0 8px' }}>Дата</label>
        <input
          type="date"
          className="field"
          value={pickDate}
          max={todayISO()}
          onChange={(e) => setPickDate(e.target.value)}
        />
        <div style={{ marginTop: 20 }}>
          <button className="btn" onClick={() => openDate(pickDate)}>
            {pickDate === todayISO() ? 'Начать тренировку' : `Открыть ${formatDayYear(pickDate)}`}
          </button>
        </div>
      </Sheet>

      <Sheet open={dataOpen} onClose={() => setDataOpen(false)} title="Настройки">
        <div className="section-label" style={{ margin: '4px 0 8px' }}>Тема оформления</div>
        <div className="chips-wrap" style={{ marginBottom: 8 }}>
          {THEMES.map((t) => (
            <button key={t.value} className={'chip' + (theme === t.value ? ' active' : '')} onClick={() => changeTheme(t.value)}>{t.label}</button>
          ))}
        </div>

        <div className="section-label" style={{ margin: '20px 0 8px' }}>Данные и бэкап</div>
        <p className="muted" style={{ marginBottom: 16, lineHeight: 1.5 }}>
          Все тренировки хранятся на этом устройстве. Сохраняй бэкап в файл время от времени —
          так данные не потеряются, и их можно перенести на другой телефон.
        </p>

        <button className="btn" onClick={() => downloadBackup()}>
          <IconDownload style={{ width: 20, height: 20 }} /> Сохранить бэкап в файл
        </button>

        <button className="btn ghost" style={{ marginTop: 10 }} onClick={() => fileRef.current?.click()}>
          <IconUpload style={{ width: 20, height: 20 }} /> Восстановить из файла
        </button>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={handleFile} />

        <p className="tiny muted center" style={{ marginTop: 12 }}>
          Восстановление заменит текущие данные данными из файла.
        </p>

        {importInfo && (
          <div className="card" style={{ marginTop: 14, background: 'var(--accent-soft)', boxShadow: 'none', textAlign: 'center' }}>
            <div style={{ fontWeight: 700, color: 'var(--accent)' }}>Готово ✓</div>
            <div className="tiny muted" style={{ marginTop: 4 }}>
              Загружено: {importInfo.workouts} трен., {importInfo.exercises} упр., {importInfo.templates} шаблонов
            </div>
          </div>
        )}
        {importErr && (
          <div className="card" style={{ marginTop: 14, background: 'var(--danger-soft)', boxShadow: 'none', textAlign: 'center', color: 'var(--danger)' }}>
            {importErr}
          </div>
        )}
      </Sheet>
    </div>
  )
}
