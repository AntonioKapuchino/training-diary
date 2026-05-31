import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { addExercise } from '../db/store'
import { MUSCLE_GROUPS, KIND_LABEL, type Exercise, type MuscleGroup, type ExerciseKind } from '../db/types'
import { GROUP_COLOR } from '../lib/groupColor'
import { IconPlus, IconChevron } from './icons'
import Sheet from './Sheet'

interface Props {
  open: boolean
  onClose: () => void
  onPick: (ex: Exercise) => void
}

export default function ExercisePicker({ open, onClose, onPick }: Props) {
  const [q, setQ] = useState('')
  const [group, setGroup] = useState<MuscleGroup | 'Все'>('Все')
  const [newGroup, setNewGroup] = useState<MuscleGroup>('Грудь')
  const [newKind, setNewKind] = useState<ExerciseKind>('strength')

  const exercises = useLiveQuery(() => db.exercises.toArray(), [])

  const filtered = useMemo(() => {
    let list = exercises ?? []
    if (group !== 'Все') list = list.filter((e) => e.group === group)
    const query = q.trim().toLowerCase()
    if (query) list = list.filter((e) => e.name.toLowerCase().includes(query))
    return list.sort((a, b) => a.name.localeCompare(b.name, 'ru'))
  }, [exercises, group, q])

  const exactMatch = (exercises ?? []).some(
    (e) => e.name.toLowerCase() === q.trim().toLowerCase()
  )

  async function createAndPick() {
    const name = q.trim()
    if (!name) return
    const id = await addExercise(name, newGroup, newKind)
    onPick({ id, name, group: newGroup, kind: newKind, isCustom: true })
    setQ('')
  }

  return (
    <Sheet open={open} onClose={onClose} title="Упражнение">
      <input
        className="field"
        placeholder="Поиск или новое упражнение…"
        value={q}
        autoFocus
        onChange={(e) => setQ(e.target.value)}
        style={{ marginBottom: 10 }}
      />

      <div className="chips-wrap">
        <button className={'chip' + (group === 'Все' ? ' active' : '')} onClick={() => setGroup('Все')}>Все</button>
        {MUSCLE_GROUPS.map((g) => (
          <button key={g} className={'chip' + (group === g ? ' active' : '')} onClick={() => setGroup(g)}>{g}</button>
        ))}
      </div>

      {/* Создание нового упражнения, если в поиске нет точного совпадения */}
      {q.trim() && !exactMatch && (
        <div className="card" style={{ marginTop: 12, background: 'var(--accent-soft)', boxShadow: 'none' }}>
          <div className="row">
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700 }}>Создать «{q.trim()}»</div>
              <select
                className="field"
                style={{ height: 40, marginTop: 8 }}
                value={newGroup}
                onChange={(e) => setNewGroup(e.target.value as MuscleGroup)}
              >
                {MUSCLE_GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
              <select
                className="field"
                style={{ height: 40, marginTop: 8 }}
                value={newKind}
                onChange={(e) => setNewKind(e.target.value as ExerciseKind)}
              >
                {Object.entries(KIND_LABEL).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
              </select>
            </div>
            <button className="icon-btn" style={{ background: 'var(--accent)', color: '#fff', width: 44, height: 44 }} onClick={createAndPick}>
              <IconPlus />
            </button>
          </div>
        </div>
      )}

      <div style={{ marginTop: 12 }}>
        {filtered.map((ex) => (
          <div
            key={ex.id}
            className="list-item tappable"
            onClick={() => onPick(ex)}
          >
            <span className="group-dot" style={{ background: GROUP_COLOR[ex.group], width: 11, height: 11 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600 }}>{ex.name}</div>
              <div className="tiny muted">{ex.group}{ex.isCustom ? ' · своё' : ''}</div>
            </div>
            <IconChevron style={{ color: 'var(--text-3)', width: 18, height: 18 }} />
          </div>
        ))}
        {filtered.length === 0 && !q.trim() && (
          <p className="muted center" style={{ padding: 20 }}>Нет упражнений в этой группе</p>
        )}
      </div>
    </Sheet>
  )
}
