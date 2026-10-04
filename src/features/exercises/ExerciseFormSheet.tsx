import clsx from 'clsx'
import { useState } from 'react'
import { createExercise, NameTakenError, updateExercise, type ExerciseInput } from '@/db/exercises'
import {
  EQUIPMENT,
  EQUIPMENT_LABEL,
  KIND_HINT,
  KIND_LABEL,
  KINDS,
  MUSCLE_LABEL,
  MUSCLES,
} from '@/domain/labels'
import type { Equipment, Exercise, ExerciseKind, MuscleGroup } from '@/domain/types'
import { Button } from '@/ui/Button'
import { MuscleDot } from '@/ui/MuscleDot'
import { Sheet } from '@/ui/Sheet'

interface Props {
  open: boolean
  onClose: () => void
  /** Правка существующего; без него — новое упражнение. */
  exercise?: Exercise
  initialName?: string
  /** Можно ли менять тип учёта (нельзя, если есть история). */
  kindLocked?: boolean
  onSaved?: (id: string) => void
  /** «Такое уже есть» — выбрать существующее. */
  onPickExisting?: (id: string) => void
}

export function ExerciseFormSheet(props: Props) {
  return (
    <Sheet
      open={props.open}
      onClose={props.onClose}
      label={props.exercise ? 'Упражнение' : 'Новое упражнение'}
      bare
    >
      <Form {...props} />
    </Sheet>
  )
}

function Form({ onClose, exercise, initialName, kindLocked, onSaved, onPickExisting }: Props) {
  const [name, setName] = useState(exercise?.name ?? initialName ?? '')
  const [muscle, setMuscle] = useState<MuscleGroup>(exercise?.muscle ?? 'chest')
  const [kind, setKind] = useState<ExerciseKind>(exercise?.kind ?? 'strength')
  const [equipment, setEquipment] = useState<Equipment>(exercise?.equipment ?? 'barbell')
  const [note, setNote] = useState(exercise?.note ?? '')
  const [taken, setTaken] = useState<Exercise | null>(null)
  const [busy, setBusy] = useState(false)

  async function save() {
    if (!name.trim()) return
    setBusy(true)
    const input: ExerciseInput = { name, muscle, kind, equipment, note }
    try {
      const id = exercise
        ? (await updateExercise(exercise.id, input), exercise.id)
        : await createExercise(input)
      onSaved?.(id)
      onClose()
    } catch (e) {
      if (e instanceof NameTakenError) setTaken(e.existing)
      else throw e
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col">
      <div className="mx-auto mt-2 h-[0.3125rem] w-9 rounded-full bg-fill" aria-hidden />
      <div className="grid grid-cols-[1fr_auto_1fr] items-center px-4 pt-2 pb-1">
        <button
          type="button"
          onClick={onClose}
          className="justify-self-start text-body text-accent"
        >
          Отмена
        </button>
        <h2 className="text-body font-semibold">{exercise ? 'Упражнение' : 'Новое упражнение'}</h2>
        <button
          type="button"
          onClick={() => void save()}
          disabled={!name.trim() || busy}
          className="justify-self-end text-body font-semibold text-accent disabled:opacity-40"
        >
          Готово
        </button>
      </div>

      <div className="space-y-5 px-4 pt-3 pb-6">
        <div>
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              setTaken(null)
            }}
            placeholder="Название"
            aria-label="Название"
            autoCapitalize="sentences"
            enterKeyHint="done"
            className="h-12 w-full rounded-[var(--radius-cell)] bg-fill-3 px-4 text-body outline-none placeholder:text-label-3 focus:bg-fill-2"
          />
          {taken && (
            <div className="mt-2 flex items-center justify-between gap-3 rounded-[var(--radius-cell)] bg-danger-soft px-3.5 py-2.5 text-subhead">
              <span className="text-danger">«{taken.name}» уже есть в каталоге</span>
              {onPickExisting && (
                <button
                  type="button"
                  className="shrink-0 font-semibold text-accent"
                  onClick={() => {
                    onPickExisting(taken.id)
                    onClose()
                  }}
                >
                  Выбрать
                </button>
              )}
            </div>
          )}
        </div>

        <Field label="Группа мышц">
          <div className="flex flex-wrap gap-2">
            {MUSCLES.map((m) => (
              <Chip
                key={m}
                active={muscle === m}
                onClick={() => {
                  setMuscle(m)
                }}
              >
                <MuscleDot muscle={m} />
                {MUSCLE_LABEL[m]}
              </Chip>
            ))}
          </div>
        </Field>

        <Field
          label="Как считать"
          hint={kindLocked ? 'Есть история — способ учёта не меняется' : KIND_HINT[kind]}
        >
          <div className="grid grid-cols-2 gap-2">
            {KINDS.map((k) => (
              <Chip
                key={k}
                active={kind === k}
                disabled={kindLocked && kind !== k}
                onClick={() => {
                  setKind(k)
                }}
              >
                {KIND_LABEL[k]}
              </Chip>
            ))}
          </div>
        </Field>

        <Field label="Снаряд">
          <div className="flex flex-wrap gap-2">
            {EQUIPMENT.map((e) => (
              <Chip
                key={e}
                active={equipment === e}
                onClick={() => {
                  setEquipment(e)
                }}
              >
                {EQUIPMENT_LABEL[e]}
              </Chip>
            ))}
          </div>
        </Field>

        <Field label="Заметка" hint="Видна во время тренировки: сиденье, хват, настройки тренажёра">
          <textarea
            value={note}
            onChange={(e) => {
              setNote(e.target.value)
            }}
            rows={2}
            placeholder="Например: сиденье на 4"
            className="w-full resize-none rounded-[var(--radius-cell)] bg-fill-3 px-4 py-3 text-body outline-none placeholder:text-label-3 focus:bg-fill-2"
          />
        </Field>

        <Button block size="lg" onClick={() => void save()} disabled={!name.trim() || busy}>
          {exercise ? 'Сохранить' : 'Добавить упражнение'}
        </Button>
      </div>
    </div>
  )
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="mb-2 px-1 text-footnote font-semibold text-label-2">{label}</div>
      {children}
      {hint && <div className="mt-1.5 px-1 text-caption text-label-2">{hint}</div>}
    </div>
  )
}

export function Chip({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={clsx(
        'inline-flex h-9 press-scale items-center justify-center gap-1.5 rounded-full px-3.5 text-subhead font-medium transition-colors disabled:opacity-35',
        active ? 'bg-accent text-on-accent' : 'bg-fill-3 text-label',
      )}
    >
      {children}
    </button>
  )
}
