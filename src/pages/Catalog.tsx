import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { addExercise, deleteExercise } from '../db/store'
import { MUSCLE_GROUPS, KIND_LABEL, type MuscleGroup, type ExerciseKind } from '../db/types'
import { GROUP_COLOR } from '../lib/groupColor'
import { IconPlus, IconTrash, IconDumbbell } from '../components/icons'
import Sheet from '../components/Sheet'

export default function Catalog() {
  const [q, setQ] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [name, setName] = useState('')
  const [group, setGroup] = useState<MuscleGroup>('Грудь')
  const [kind, setKind] = useState<ExerciseKind>('strength')

  const exercises = useLiveQuery(() => db.exercises.toArray(), [])

  const grouped = useMemo(() => {
    const query = q.trim().toLowerCase()
    const map = new Map<MuscleGroup, typeof exercises>()
    for (const g of MUSCLE_GROUPS) map.set(g, [])
    for (const ex of exercises ?? []) {
      if (query && !ex.name.toLowerCase().includes(query)) continue
      map.get(ex.group)!.push(ex)
    }
    for (const arr of map.values()) arr!.sort((a, b) => a.name.localeCompare(b.name, 'ru'))
    return map
  }, [exercises, q])

  async function handleAdd() {
    if (!name.trim()) return
    await addExercise(name, group, kind)
    setName('')
    setAddOpen(false)
  }

  return (
    <div className="screen">
      <div className="screen-header">
        <div className="screen-title">Упражнения</div>
        <div className="screen-sub">{exercises?.length ?? 0} в каталоге</div>
      </div>

      <input className="field" placeholder="Поиск упражнения…" value={q} onChange={(e) => setQ(e.target.value)} />

      {MUSCLE_GROUPS.map((g) => {
        const list = grouped.get(g) ?? []
        if (list.length === 0) return null
        return (
          <div key={g}>
            <div className="section-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="group-dot" style={{ background: GROUP_COLOR[g] }} /> {g}
            </div>
            <div className="card" style={{ padding: '4px 16px' }}>
              {list.map((ex) => (
                <div key={ex.id} className="list-item">
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>{ex.name}</div>
                    <div className="tiny muted">{KIND_LABEL[ex.kind ?? 'strength']}{ex.isCustom ? ' · своё' : ''}</div>
                  </div>
                  {ex.isCustom && (
                    <button className="icon-btn" style={{ color: 'var(--text-3)' }} onClick={() => deleteExercise(ex.id!)}>
                      <IconTrash style={{ width: 18, height: 18 }} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )
      })}

      {exercises && exercises.length === 0 && (
        <div className="empty">
          <div className="em-icon"><IconDumbbell /></div>
          <h3>Каталог пуст</h3>
        </div>
      )}

      <button className="fab" onClick={() => setAddOpen(true)}>
        <IconPlus style={{ width: 22, height: 22 }} /> Своё упражнение
      </button>

      <Sheet open={addOpen} onClose={() => setAddOpen(false)} title="Новое упражнение">
        <label className="section-label" style={{ margin: '4px 0 8px' }}>Название</label>
        <input className="field" placeholder="Напр. «Тяга к поясу»" value={name} autoFocus onChange={(e) => setName(e.target.value)} />
        <label className="section-label" style={{ margin: '16px 0 8px' }}>Группа мышц</label>
        <div className="chips-wrap">
          {MUSCLE_GROUPS.map((gr) => (
            <button key={gr} className={'chip' + (group === gr ? ' active' : '')} onClick={() => setGroup(gr)}>{gr}</button>
          ))}
        </div>
        <label className="section-label" style={{ margin: '16px 0 8px' }}>Как считать</label>
        <div className="chips-wrap">
          {(Object.keys(KIND_LABEL) as ExerciseKind[]).map((k) => (
            <button key={k} className={'chip' + (kind === k ? ' active' : '')} onClick={() => setKind(k)}>{KIND_LABEL[k]}</button>
          ))}
        </div>
        <button className="btn" style={{ marginTop: 20 }} onClick={handleAdd}>Добавить</button>
      </Sheet>
    </div>
  )
}
