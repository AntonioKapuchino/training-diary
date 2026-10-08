import { ArrowDownUp, History, MessageSquareText, Plus, Repeat, Timer, Trash2 } from 'lucide-react'
import { AnimatePresence } from 'motion/react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { updateExercise } from '@/db/exercises'
import { useEntries, useExerciseMap } from '@/db/hooks'
import {
  addExercises,
  addSet,
  removeEntry,
  removeSet,
  reorderEntries,
  replaceExercise,
  restoreEntry,
  restoreSet,
  toggleSetDone,
  updateEntry,
  updateSet,
  type SetPatch,
} from '@/db/workouts'
import { formatClock, formatNumber } from '@/domain/format'
import { SET_TYPE_LABEL, SET_TYPES } from '@/domain/labels'
import { platesFor } from '@/domain/plates'
import { emptyBests, recordSets } from '@/domain/records'
import { fieldsFor, isComplete, isWorking, pickValues, type FieldSpec } from '@/domain/sets'
import type { Exercise, SetField, Workout, WorkoutEntry, WorkoutSet } from '@/domain/types'
import { ExercisePicker } from '@/features/exercises/ExercisePicker'
import { haptic } from '@/lib/haptics'
import { unlockAudio } from '@/lib/sound'
import { useSettings, type Settings } from '@/settings/settings'
import { ActionSheet, type Action } from '@/ui/ActionSheet'
import { toast } from '@/ui/Toast'
import { ExerciseCard } from './ExerciseCard'
import { ExerciseHistorySheet, NoteSheet, ReorderSheet, RestSheet } from './EditorSheets'
import { fillHints, matchPrevious, type Hint } from './hints'
import { Keypad } from './Keypad'
import { displayDraft, draftOf, pressKey, stepValue, valueOf, type Key } from './keypadLogic'
import { getWorkoutUi, useWorkoutUi, workoutUi } from './store'
import { useRestTicker } from './RestTimer'
import { useWorkoutContext } from './useWorkoutContext'

interface Props {
  workout: Workout
  /** live — идущая тренировка с отметками и отдыхом; past — правка прошлой. */
  mode: 'live' | 'past'
}

interface Row {
  entry: WorkoutEntry
  exercise: Exercise
  previous: (Hint | undefined)[]
  fill: (Hint | undefined)[]
  records: ReturnType<typeof recordSets>
}

function restFor(entry: WorkoutEntry, ex: Exercise, s: Settings): number {
  return entry.restSec ?? ex.restSec ?? s.restSec
}

function specFor(ex: Exercise, field: SetField, s: Settings): FieldSpec | undefined {
  const spec = fieldsFor(ex.kind).find((f) => f.field === field)
  if (!spec) return undefined
  return field === 'weight' ? { ...spec, step: s.weightStep } : spec
}

export function WorkoutEditor({ workout, mode }: Props) {
  const entries = useEntries(workout.id)
  const exercises = useExerciseMap()
  const ctx = useWorkoutContext(workout, entries, exercises)
  const settings = useSettings()
  const ui = useWorkoutUi()
  const rest = useRestTicker()
  const past = mode === 'past'

  const [picker, setPicker] = useState<{ replace?: string } | null>(null)
  const [entryMenu, setEntryMenu] = useState<string | null>(null)
  const [setMenu, setSetMenu] = useState<{ entryId: string; setId: string } | null>(null)
  const [noteFor, setNoteFor] = useState<string | null>(null)
  const [restSheet, setRestSheet] = useState<string | null>(null)
  const [historyOf, setHistoryOf] = useState<Exercise | null>(null)
  const [reorder, setReorder] = useState(false)

  const rows = useMemo<Row[]>(() => {
    if (!entries || !exercises) return []
    return entries.flatMap((entry) => {
      const exercise = exercises.get(entry.exerciseId)
      if (!exercise) return []
      const last = ctx?.previous.get(entry.exerciseId) ?? []
      const source = last.length > 0 ? last : (ctx?.template.get(entry.exerciseId) ?? [])
      const previous = matchPrevious(entry.sets, source)
      return [
        {
          entry,
          exercise,
          previous,
          fill: fillHints(entry.sets, previous),
          records: recordSets(
            exercise.kind,
            ctx?.bests.get(entry.exerciseId) ?? emptyBests(),
            entry.sets,
          ),
        },
      ]
    })
  }, [entries, exercises, ctx])

  const rowOf = useCallback((entryId: string) => rows.find((r) => r.entry.id === entryId), [rows])
  const target = ui.keypad?.workoutId === workout.id && rowOf(ui.keypad.entryId) ? ui.keypad : null

  // Ячейка под клавиатурой должна быть видна.
  useEffect(() => {
    if (!target) return
    const el = document.querySelector(`[data-set="${target.setId}"]`)
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [target?.setId, target])

  // Закрыть клавиатуру, если её подход удалили. Чужую — другой тренировки — не трогаем.
  useEffect(() => {
    if (ui.keypad?.workoutId !== workout.id) return
    const row = rowOf(ui.keypad.entryId)
    if (entries && !row?.entry.sets.some((s) => s.id === ui.keypad?.setId)) workoutUi.closeKeypad()
  }, [ui.keypad, rowOf, entries, workout.id])

  function commit(row: Row, set: WorkoutSet, field: SetField, value: number | undefined) {
    const patch: SetPatch = { [field]: value }
    if (past) patch.done = isComplete(row.exercise.kind, { ...set, [field]: value })
    void updateSet(row.entry.id, set.id, patch)
  }

  function focusFirstEmpty(row: Row, set: WorkoutSet) {
    const fields = fieldsFor(row.exercise.kind)
    const empty = fields.find((f) => (set[f.field] ?? 0) === 0) ?? fields[0]
    if (empty)
      workoutUi.focus({
        workoutId: workout.id,
        entryId: row.entry.id,
        setId: set.id,
        field: empty.field,
      })
  }

  async function toggle(row: Row, setId: string, fromKeypad = false): Promise<boolean> {
    haptic()
    unlockAudio()
    const i = row.entry.sets.findIndex((s) => s.id === setId)
    const set = row.entry.sets[i]
    if (!set) return false
    const result = await toggleSetDone(row.entry.id, setId, row.exercise.kind, row.fill[i])
    if (result === 'incomplete') {
      if (!fromKeypad) focusFirstEmpty(row, set)
      return false
    }
    if (result === 'done') {
      if (!past && settings.restTimer !== 'off')
        workoutUi.startRest(restFor(row.entry, row.exercise, settings))
      if (!fromKeypad && ui.keypad?.setId === setId) workoutUi.closeKeypad()
    }
    return true
  }

  function copyPrevious(row: Row, setId: string) {
    const i = row.entry.sets.findIndex((s) => s.id === setId)
    const hint = row.previous[i]
    const set = row.entry.sets[i]
    if (!hint || !set) return
    haptic()
    const patch: SetPatch = pickValues(hint)
    if (past) patch.done = isComplete(row.exercise.kind, { ...set, ...hint })
    void updateSet(row.entry.id, setId, patch)
  }

  async function deleteSet(row: Row, setId: string) {
    const removed = await removeSet(row.entry.id, setId)
    if (removed) {
      toast('Подход удалён', { label: 'Вернуть', onAction: () => void restoreSet(removed) })
    }
  }

  async function deleteEntry(entryId: string) {
    const removed = await removeEntry(entryId)
    const name = removed ? exercises?.get(removed.exerciseId)?.name : undefined
    if (removed) {
      toast(`«${name ?? 'Упражнение'}» убрано`, {
        label: 'Вернуть',
        onAction: () => void restoreEntry(removed),
      })
    }
  }

  // ---------- Клавиатура ----------
  const keypadRow = target ? rowOf(target.entryId) : undefined
  const keypadSetIndex =
    keypadRow && target ? keypadRow.entry.sets.findIndex((s) => s.id === target.setId) : -1
  const keypadSet = keypadRow?.entry.sets[keypadSetIndex]
  const keypadSpec =
    keypadRow && target ? specFor(keypadRow.exercise, target.field, settings) : undefined
  const draftText = keypadSpec && ui.draft !== null ? displayDraft(keypadSpec, ui.draft) : null

  function onKey(key: Key) {
    if (!keypadRow || !keypadSet || !keypadSpec || !target) return
    // Черновик — из хранилища, а не из замыкания: быстрые нажатия подряд
    // приходят раньше перерисовки, и вторая цифра иначе потеряла бы первую.
    const st = getWorkoutUi()
    const current = st.draft ?? draftOf(keypadSpec, keypadSet[target.field])
    const next = pressKey(keypadSpec, current, key, st.fresh)
    workoutUi.typed(next)
    commit(keypadRow, keypadSet, target.field, valueOf(keypadSpec, next))
  }

  function onStep(dir: 1 | -1) {
    if (!keypadRow || !keypadSet || !keypadSpec || !target) return
    const hint = keypadRow.fill[keypadSetIndex]?.[target.field]
    const v = stepValue(keypadSet[target.field], hint, keypadSpec.step, dir)
    workoutUi.retype(draftOf(keypadSpec, v))
    commit(keypadRow, keypadSet, target.field, v)
  }

  const fieldsOfTarget = keypadRow ? fieldsFor(keypadRow.exercise.kind) : []
  const fieldIndex = target ? fieldsOfTarget.findIndex((f) => f.field === target.field) : -1
  const lastField = fieldIndex === fieldsOfTarget.length - 1

  async function onNext() {
    if (!keypadRow || !keypadSet || !target) return
    // «Далее» на нетронутой пустой ячейке принимает серую подсказку — повторить прошлый раз
    // можно, не набирая цифры.
    const current = keypadSet[target.field]
    const hint = keypadRow.fill[keypadSetIndex]?.[target.field]
    if (
      (current === undefined || current === 0) &&
      hint !== undefined &&
      getWorkoutUi().draft === null
    ) {
      commit(keypadRow, keypadSet, target.field, hint)
    }
    const nextField = fieldsOfTarget[fieldIndex + 1]
    if (nextField) {
      workoutUi.focus({
        workoutId: workout.id,
        entryId: target.entryId,
        setId: target.setId,
        field: nextField.field,
      })
      return
    }
    if (!past && !keypadSet.done) {
      const ok = await toggle(keypadRow, keypadSet.id, true)
      if (!ok) {
        focusFirstEmpty(keypadRow, keypadSet)
        return
      }
    }
    const nextSet = keypadRow.entry.sets.slice(keypadSetIndex + 1).find((s) => past || !s.done)
    const first = fieldsOfTarget[0]
    if (nextSet && first)
      workoutUi.focus({
        workoutId: workout.id,
        entryId: target.entryId,
        setId: nextSet.id,
        field: first.field,
      })
    else workoutUi.closeKeypad()
  }

  let accessory: string | undefined
  if (
    keypadRow &&
    keypadSet &&
    target?.field === 'weight' &&
    keypadRow.exercise.equipment === 'barbell'
  ) {
    const w = keypadSet.weight ?? keypadRow.fill[keypadSetIndex]?.weight
    const plates = w !== undefined ? platesFor(w, settings.barWeight, settings.plates) : null
    if (plates) {
      accessory =
        plates.perSide.length === 0
          ? 'Пустой гриф'
          : `По бокам: ${plates.perSide.map((p) => formatNumber(p)).join(' + ')}${plates.missing > 0 ? ` (не хватает ${formatNumber(plates.missing)})` : ''}`
    }
  }

  // ---------- Меню ----------
  const menuRow = entryMenu ? rowOf(entryMenu) : undefined
  const entryActions: Action[] = menuRow
    ? [
        {
          label: 'Комментарий',
          icon: <MessageSquareText className="size-5" />,
          onSelect: () => {
            setNoteFor(menuRow.entry.id)
          },
        },
        ...(!past
          ? [
              {
                label: `Отдых: ${formatClock(restFor(menuRow.entry, menuRow.exercise, settings))}`,
                icon: <Timer className="size-5" />,
                onSelect: () => {
                  setRestSheet(menuRow.entry.id)
                },
              },
            ]
          : []),
        {
          label: 'История упражнения',
          icon: <History className="size-5" />,
          onSelect: () => {
            setHistoryOf(menuRow.exercise)
          },
        },
        {
          label: 'Заменить упражнение',
          icon: <Repeat className="size-5" />,
          onSelect: () => {
            setPicker({ replace: menuRow.entry.id })
          },
        },
        {
          label: 'Изменить порядок',
          icon: <ArrowDownUp className="size-5" />,
          onSelect: () => {
            setReorder(true)
          },
        },
        {
          label: 'Убрать из тренировки',
          icon: <Trash2 className="size-5" />,
          destructive: true,
          onSelect: () => void deleteEntry(menuRow.entry.id),
        },
      ]
    : []

  const setMenuRow = setMenu ? rowOf(setMenu.entryId) : undefined
  const setActions: Action[] =
    setMenu && setMenuRow
      ? [
          ...SET_TYPES.map((t) => ({
            label: SET_TYPE_LABEL[t],
            onSelect: () => void updateSet(setMenu.entryId, setMenu.setId, { type: t }),
          })),
          {
            label: 'Удалить подход',
            destructive: true,
            onSelect: () => void deleteSet(setMenuRow, setMenu.setId),
          },
        ]
      : []

  const noteRow = noteFor ? rowOf(noteFor) : undefined
  const restRow = restSheet ? rowOf(restSheet) : undefined

  if (!entries || !exercises) return <div className="h-40" />

  return (
    <div className="space-y-3 px-4">
      {rows.map((row) => (
        <div key={row.entry.id} data-entry={row.entry.id}>
          <ExerciseCard
            entry={row.entry}
            exercise={row.exercise}
            previous={row.previous}
            fill={row.fill}
            records={row.records}
            active={
              target?.entryId === row.entry.id ? { setId: target.setId, field: target.field } : null
            }
            draftText={target?.entryId === row.entry.id ? draftText : null}
            restSec={restFor(row.entry, row.exercise, settings)}
            past={past}
            onCell={(setId, field) => {
              workoutUi.focus({ workoutId: workout.id, entryId: row.entry.id, setId, field })
            }}
            onToggle={(setId) => void toggle(row, setId)}
            onCopyPrevious={(setId) => {
              copyPrevious(row, setId)
            }}
            onSetMenu={(setId) => {
              setSetMenu({ entryId: row.entry.id, setId })
            }}
            onDeleteSet={(setId) => void deleteSet(row, setId)}
            onAddSet={() => void addSet(row.entry.id)}
            onMenu={() => {
              setEntryMenu(row.entry.id)
            }}
            onOpenExercise={() => {
              setHistoryOf(row.exercise)
            }}
          />
        </div>
      ))}

      <button
        type="button"
        onClick={() => {
          setPicker({})
        }}
        className="flex h-[3.25rem] w-full press-scale items-center justify-center gap-2 rounded-full bg-accent-soft text-body font-semibold text-accent"
      >
        <Plus className="size-5" strokeWidth={2.6} /> Добавить упражнение
      </button>

      {/* Под клавиатурой — место, чтобы последний подход можно было прокрутить выше неё. */}
      <div style={{ height: target ? 330 : 0 }} aria-hidden />

      <AnimatePresence>
        {target && keypadRow && keypadSpec && keypadSet && (
          <Keypad
            key="keypad"
            title={keypadSpec.unit ? `${keypadSpec.title}, ${keypadSpec.unit}` : keypadSpec.title}
            subtitle={`${keypadRow.exercise.name} · подход ${keypadSetIndex + 1}${isWorking(keypadSet) ? '' : ` (${SET_TYPE_LABEL[keypadSet.type].toLowerCase()})`}`}
            accessory={accessory}
            restLeft={past ? null : (rest?.left ?? null)}
            allowDecimal={keypadSpec.decimals > 0 && !keypadSpec.duration}
            nextLabel={lastField && !past && !keypadSet.done ? 'Готово' : 'Далее'}
            onKey={onKey}
            onStep={onStep}
            onNext={() => void onNext()}
            onClose={workoutUi.closeKeypad}
          />
        )}
      </AnimatePresence>

      <ExercisePicker
        open={picker !== null}
        multiple={!picker?.replace}
        title={picker?.replace ? 'Заменить на' : 'Добавить упражнения'}
        onClose={() => {
          setPicker(null)
        }}
        onPick={(ids) => {
          const replaceId = picker?.replace
          const first = ids[0]
          if (replaceId && first) void replaceExercise(replaceId, first)
          else void addExercises(workout.id, ids)
        }}
      />

      <ActionSheet
        open={menuRow !== undefined}
        onClose={() => {
          setEntryMenu(null)
        }}
        title={menuRow?.exercise.name}
        actions={entryActions}
      />
      <ActionSheet
        open={setMenu !== null}
        onClose={() => {
          setSetMenu(null)
        }}
        title="Тип подхода"
        message="Разминочные подходы не идут в объём и рекорды"
        actions={setActions}
      />
      <NoteSheet
        open={noteRow !== undefined}
        initial={noteRow?.entry.note ?? ''}
        title={noteRow ? `Комментарий: ${noteRow.exercise.name}` : ''}
        onClose={() => {
          setNoteFor(null)
        }}
        onSave={(note) => {
          if (noteRow) void updateEntry(noteRow.entry.id, { note })
        }}
      />
      <RestSheet
        open={restRow !== undefined}
        value={restRow ? restFor(restRow.entry, restRow.exercise, settings) : settings.restSec}
        onClose={() => {
          setRestSheet(null)
        }}
        onPick={(sec, remember) => {
          if (!restRow) return
          void updateEntry(restRow.entry.id, { restSec: sec })
          if (remember) void updateExercise(restRow.exercise.id, { restSec: sec })
        }}
      />
      <ReorderSheet
        open={reorder}
        entries={entries}
        exercises={exercises}
        onClose={() => {
          setReorder(false)
        }}
        onSave={(ids) => void reorderEntries(workout.id, ids)}
      />
      <ExerciseHistorySheet
        exercise={historyOf}
        onClose={() => {
          setHistoryOf(null)
        }}
      />
    </div>
  )
}
