import { Ellipsis, MessageSquareText, Plus, Timer } from 'lucide-react'
import { motion } from 'motion/react'
import { useMemo } from 'react'
import { formatClock } from '@/domain/format'
import { EQUIPMENT_LABEL, MUSCLE_LABEL } from '@/domain/labels'
import type { RecordType } from '@/domain/records'
import { fieldsFor, isWorking } from '@/domain/sets'
import type { Exercise, SetField, WorkoutEntry } from '@/domain/types'
import { MuscleDot } from '@/ui/MuscleDot'
import type { Hint } from './hints'
import { SET_GRID, SetRow } from './SetRow'

interface Props {
  entry: WorkoutEntry
  exercise: Exercise
  previous: readonly (Hint | undefined)[]
  fill: readonly (Hint | undefined)[]
  records: ReadonlyMap<string, RecordType[]>
  /** Активная ячейка клавиатуры, если она в этом упражнении. */
  active: { setId: string; field: SetField } | null
  draftText: string | null
  restSec: number
  past: boolean
  onCell: (setId: string, field: SetField) => void
  onToggle: (setId: string) => void
  onCopyPrevious: (setId: string) => void
  onSetMenu: (setId: string) => void
  onDeleteSet: (setId: string) => void
  onAddSet: () => void
  onMenu: () => void
  onOpenExercise: () => void
}

export function ExerciseCard({
  entry,
  exercise,
  previous,
  fill,
  records,
  active,
  draftText,
  restSec,
  past,
  onCell,
  onToggle,
  onCopyPrevious,
  onSetMenu,
  onDeleteSet,
  onAddSet,
  onMenu,
  onOpenExercise,
}: Props) {
  const fields = fieldsFor(exercise.kind)
  const numbers = useMemo(() => {
    let n = 0
    return entry.sets.map((s) => (isWorking(s) ? ++n : 0))
  }, [entry.sets])
  const doneCount = entry.sets.filter((s) => s.done).length

  return (
    <motion.article
      layout="position"
      className="overflow-hidden rounded-[var(--radius-card)] bg-surface shadow-[var(--shadow-card)]"
      aria-label={exercise.name}
    >
      <header className="flex items-start gap-3 px-4 pt-3.5 pb-2">
        <button type="button" onClick={onOpenExercise} className="min-w-0 flex-1 text-left">
          <div className="flex items-center gap-2">
            <MuscleDot muscle={exercise.muscle} size={10} />
            <h3 className="truncate text-body font-semibold">{exercise.name}</h3>
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-footnote text-label-2">
            <span>
              {MUSCLE_LABEL[exercise.muscle]} · {EQUIPMENT_LABEL[exercise.equipment]}
            </span>
            {!past && (
              <span className="inline-flex items-center gap-0.5">
                <Timer className="size-3.5" aria-hidden /> {formatClock(restSec)}
              </span>
            )}
            {!past && entry.sets.length > 0 && (
              <span className="tabular">
                {doneCount}/{entry.sets.length}
              </span>
            )}
          </div>
          {exercise.note && (
            <p className="mt-1 text-footnote text-label-2 italic">{exercise.note}</p>
          )}
        </button>
        <button
          type="button"
          onClick={onMenu}
          aria-label={`Действия: ${exercise.name}`}
          className="-mr-1 flex size-9 shrink-0 press-scale items-center justify-center rounded-full bg-fill-3 text-accent"
        >
          <Ellipsis className="size-5" strokeWidth={2.4} />
        </button>
      </header>

      {entry.note && (
        <p className="mx-4 mb-2 flex items-start gap-1.5 rounded-[0.75rem] bg-fill-3 px-3 py-2 text-footnote text-label-2">
          <MessageSquareText className="mt-px size-3.5 shrink-0" aria-hidden />
          <span className="whitespace-pre-wrap">{entry.note}</span>
        </p>
      )}

      <div
        className={`${SET_GRID} px-3 pb-1 text-caption-2 font-semibold text-label-3 uppercase`}
        style={{ ['--cols' as string]: fields.length }}
        aria-hidden
      >
        <span className="text-center">#</span>
        <span>Прошлый раз</span>
        {fields.map((f) => (
          <span key={f.field} className="text-center">
            {f.label}
          </span>
        ))}
        <span />
      </div>

      <div>
        {entry.sets.map((s, i) => (
          <SetRow
            key={s.id}
            kind={exercise.kind}
            set={s}
            number={numbers[i] ?? 0}
            fields={fields}
            previous={previous[i]}
            fill={fill[i]}
            activeField={active?.setId === s.id ? active.field : null}
            draftText={active?.setId === s.id ? draftText : null}
            record={records.get(s.id)}
            past={past}
            onCell={(field) => {
              onCell(s.id, field)
            }}
            onToggle={() => {
              onToggle(s.id)
            }}
            onCopyPrevious={() => {
              onCopyPrevious(s.id)
            }}
            onTypeMenu={() => {
              onSetMenu(s.id)
            }}
            onDelete={() => {
              onDeleteSet(s.id)
            }}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={onAddSet}
        className="flex h-11 w-full items-center justify-center gap-1.5 pressable text-subhead font-semibold text-accent"
      >
        <Plus className="size-4" strokeWidth={2.6} /> Подход
      </button>
    </motion.article>
  )
}
