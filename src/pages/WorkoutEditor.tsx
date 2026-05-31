import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import {
  getOrCreateWorkout, addEntry, updateEntry, deleteEntry,
  deleteWorkout, setWorkoutNote, saveTemplateFromWorkout, lastEntryFor,
} from '../db/store'
import type { Exercise, SetEntry, WorkoutEntry } from '../db/types'
import { columnsFor, defaultSet, summaryFor, strengthVolume } from '../lib/exerciseKind'
import { formatFull } from '../lib/date'
import { GROUP_COLOR } from '../lib/groupColor'
import { IconBack, IconPlus, IconTrash, IconClose, IconNote, IconTemplate } from '../components/icons'
import ExercisePicker from '../components/ExercisePicker'
import Sheet from '../components/Sheet'

export default function WorkoutEditor() {
  const { date = '' } = useParams()
  const nav = useNavigate()
  const [workoutId, setWorkoutId] = useState<number | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [tplOpen, setTplOpen] = useState(false)
  const [tplName, setTplName] = useState('')
  const [confirmDel, setConfirmDel] = useState(false)

  useEffect(() => {
    let active = true
    getOrCreateWorkout(date).then((id) => active && setWorkoutId(id))
    return () => { active = false }
  }, [date])

  const workout = useLiveQuery(() => (workoutId ? db.workouts.get(workoutId) : undefined), [workoutId])
  const entries = useLiveQuery(
    () => (workoutId ? db.entries.where('workoutId').equals(workoutId).sortBy('order') : Promise.resolve([] as WorkoutEntry[])),
    [workoutId],
  )

  async function handlePick(ex: Exercise) {
    if (!workoutId) return
    const prev = await lastEntryFor(ex.id!)
    const sets = prev ? prev.sets.map((s) => ({ ...s })) : [defaultSet(ex.kind)]
    await addEntry(workoutId, ex, sets)
    setPickerOpen(false)
  }

  async function handleSaveTemplate() {
    if (!entries || entries.length === 0) return
    const name = tplName.trim() || formatFull(date)
    await saveTemplateFromWorkout(name, entries)
    setTplOpen(false)
    setTplName('')
  }

  async function handleDeleteWorkout() {
    if (workoutId) await deleteWorkout(workoutId)
    nav('/')
  }

  const totalVol = (entries ?? []).reduce((s, e) => s + strengthVolume(e.kind, e.sets), 0)

  return (
    <div className="screen">
      <div className="row" style={{ paddingTop: 'var(--safe-top)', marginBottom: 6 }}>
        <button className="icon-btn" onClick={() => nav('/')}><IconBack /></button>
        <div className="spacer" />
        {(entries?.length ?? 0) > 0 && (
          <button className="icon-btn" title="Сохранить как шаблон" onClick={() => setTplOpen(true)}><IconTemplate /></button>
        )}
        <button className="icon-btn" title="Удалить тренировку" onClick={() => setConfirmDel(true)} style={{ color: 'var(--danger)' }}><IconTrash /></button>
      </div>

      <div className="screen-header" style={{ paddingTop: 4 }}>
        <div className="screen-title" style={{ fontSize: 27 }}>{formatFull(date)}</div>
        {totalVol > 0 && <div className="screen-sub">Общий объём: {Math.round(totalVol).toLocaleString('ru')} кг</div>}
      </div>

      {(entries ?? []).map((entry) => (
        <EntryCard key={entry.id} entry={entry} onDelete={() => deleteEntry(entry.id!)} />
      ))}

      {(entries?.length ?? 0) === 0 && (
        <div className="empty">
          <div className="em-icon"><IconPlus /></div>
          <h3>Добавь упражнения</h3>
          <p>Нажми кнопку ниже и выбери из каталога или создай своё.</p>
        </div>
      )}

      <button className="btn secondary" style={{ marginTop: 14 }} onClick={() => setPickerOpen(true)}>
        <IconPlus style={{ width: 20, height: 20 }} /> Добавить упражнение
      </button>

      <div className="section-label">Заметка по тренировке</div>
      <textarea
        className="field"
        placeholder="Как прошла, самочувствие, мысли…"
        defaultValue={workout?.note ?? ''}
        key={workout?.id /* пересоздать при загрузке */}
        onBlur={(e) => workoutId && setWorkoutNote(workoutId, e.target.value)}
      />

      <ExercisePicker open={pickerOpen} onClose={() => setPickerOpen(false)} onPick={handlePick} />

      <Sheet open={tplOpen} onClose={() => setTplOpen(false)} title="Сохранить как шаблон">
        <p className="muted" style={{ marginBottom: 14 }}>Сохраним список упражнений и подходы — потом применишь в один тап.</p>
        <input className="field" placeholder="Название (напр. «День груди»)" value={tplName} onChange={(e) => setTplName(e.target.value)} />
        <button className="btn" style={{ marginTop: 16 }} onClick={handleSaveTemplate}>Сохранить шаблон</button>
      </Sheet>

      <Sheet open={confirmDel} onClose={() => setConfirmDel(false)} title="Удалить тренировку?">
        <p className="muted" style={{ marginBottom: 18 }}>Тренировка за {formatFull(date)} и все упражнения в ней будут удалены.</p>
        <button className="btn danger" onClick={handleDeleteWorkout}><IconTrash style={{ width: 20, height: 20 }} /> Удалить</button>
        <button className="btn ghost" style={{ marginTop: 10 }} onClick={() => setConfirmDel(false)}>Отмена</button>
      </Sheet>
    </div>
  )
}

/* ---------- Карточка одного упражнения ---------- */

function EntryCard({ entry, onDelete }: { entry: WorkoutEntry; onDelete: () => void }) {
  const [sets, setSets] = useState<SetEntry[]>(entry.sets)
  const [comment, setComment] = useState(entry.comment ?? '')
  const [showComment, setShowComment] = useState(!!entry.comment)

  // Пересеять при смене записи
  useEffect(() => {
    setSets(entry.sets)
    setComment(entry.comment ?? '')
    setShowComment(!!entry.comment)
  }, [entry.id])

  function persist(next: SetEntry[]) {
    setSets(next)
    updateEntry(entry.id!, { sets: next })
  }

  function changeSet(i: number, patch: Partial<SetEntry>) {
    persist(sets.map((s, idx) => (idx === i ? { ...s, ...patch } : s)))
  }
  function addSet() {
    const last = sets[sets.length - 1] ?? defaultSet(entry.kind)
    persist([...sets, { ...last }])
  }
  function removeSet(i: number) {
    if (sets.length <= 1) return
    persist(sets.filter((_, idx) => idx !== i))
  }

  const cols = columnsFor(entry.kind)

  return (
    <div className="card">
      <div className="row" style={{ marginBottom: 12 }}>
        <span className="group-dot" style={{ background: GROUP_COLOR[entry.group], width: 11, height: 11 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 750, fontSize: 17, letterSpacing: '-0.01em' }}>{entry.exerciseName}</div>
          <div className="tiny muted">{summaryFor(entry.kind, sets)}</div>
        </div>
        <button className="icon-btn" onClick={onDelete} style={{ color: 'var(--text-3)' }}><IconTrash style={{ width: 18, height: 18 }} /></button>
      </div>

      <div className="set-row">
        <div className="set-label">#</div>
        {cols.map((c) => <div key={c.label} className="set-label">{c.label}</div>)}
        <div />
      </div>

      {sets.map((s, i) => (
        <div className="set-row" key={i}>
          <div className="idx">{i + 1}</div>
          {cols.map((c) => {
            const v = c.get(s)
            return (
              <input
                key={c.label}
                className="set-input" type="number"
                inputMode={c.decimal ? 'decimal' : 'numeric'}
                min={0} step={c.step ?? 1}
                value={v ? v : ''}
                onChange={(e) => changeSet(i, c.apply(s, Number(e.target.value)))}
              />
            )
          })}
          <button className="icon-btn" onClick={() => removeSet(i)} disabled={sets.length <= 1}
            style={{ opacity: sets.length <= 1 ? 0.3 : 1 }}>
            <IconClose style={{ width: 16, height: 16 }} />
          </button>
        </div>
      ))}

      <button className="btn sm secondary" style={{ marginTop: 4 }} onClick={addSet}>
        <IconPlus style={{ width: 16, height: 16 }} /> Подход
      </button>

      {showComment ? (
        <textarea
          className="field"
          style={{ marginTop: 12 }}
          placeholder="Ощущения: «было тяжело», «без страховки», «чисто»…"
          value={comment}
          autoFocus={!entry.comment}
          onChange={(e) => setComment(e.target.value)}
          onBlur={(e) => updateEntry(entry.id!, { comment: e.target.value })}
        />
      ) : (
        <button className="btn sm ghost" style={{ marginTop: 12 }} onClick={() => setShowComment(true)}>
          <IconNote style={{ width: 16, height: 16 }} /> Добавить комментарий
        </button>
      )}
    </div>
  )
}
