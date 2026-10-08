import clsx from 'clsx'
import { Check, Trophy } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { SET_TYPE_BADGE, SET_TYPE_LABEL } from '@/domain/labels'
import { RECORD_LABEL, type RecordType } from '@/domain/records'
import type { FieldSpec } from '@/domain/sets'
import type { ExerciseKind, SetField, WorkoutSet } from '@/domain/types'
import { SwipeRow } from '@/ui/SwipeRow'
import { formatCell, formatHint } from './format'
import type { Hint } from './hints'

interface Props {
  kind: ExerciseKind
  set: WorkoutSet
  /** Номер рабочего подхода; у разминки и дроп-сетов — буква. */
  number: number
  fields: readonly FieldSpec[]
  previous: Hint | undefined
  fill: Hint | undefined
  activeField: SetField | null
  /** Текст активной ячейки во время ввода. */
  draftText: string | null
  record: RecordType[] | undefined
  /** В прошлой тренировке нет отметок: подход засчитан, если заполнен. */
  past: boolean
  onCell: (field: SetField) => void
  onToggle: () => void
  onCopyPrevious: () => void
  onTypeMenu: () => void
  onDelete: () => void
}

export const SET_GRID =
  'grid grid-cols-[2rem_minmax(0,1fr)_repeat(var(--cols),4.25rem)_2.25rem] items-center gap-x-2'

export function SetRow({
  kind,
  set,
  number,
  fields,
  previous,
  fill,
  activeField,
  draftText,
  record,
  past,
  onCell,
  onToggle,
  onCopyPrevious,
  onTypeMenu,
  onDelete,
}: Props) {
  const badge = SET_TYPE_BADGE[set.type] || String(number)
  const done = set.done && !past
  return (
    <SwipeRow onDelete={onDelete} label="Удалить подход">
      <div
        data-set={set.id}
        className={clsx(
          SET_GRID,
          'px-3 py-1 transition-colors duration-300',
          done && 'bg-success-soft',
        )}
        style={{ ['--cols' as string]: fields.length }}
      >
        <button
          type="button"
          onClick={onTypeMenu}
          aria-label={`Подход ${badge}, ${SET_TYPE_LABEL[set.type]}${record ? ', рекорд' : ''}. Изменить тип`}
          className={clsx(
            'relative flex h-8 w-8 press-scale items-center justify-center rounded-[0.625rem] font-rounded text-subhead font-semibold tabular',
            set.type === 'warmup' &&
              'bg-[color-mix(in_srgb,var(--warning)_18%,transparent)] text-warning',
            set.type === 'drop' && 'bg-accent-soft text-accent',
            set.type === 'failure' && 'bg-danger-soft text-danger',
            set.type === 'normal' && 'text-label-2',
          )}
        >
          {badge}
          <AnimatePresence>
            {record && (
              <motion.span
                initial={{ scale: 0, rotate: -30 }}
                animate={{ scale: 1, rotate: 0 }}
                exit={{ scale: 0 }}
                transition={{ type: 'spring', stiffness: 600, damping: 18 }}
                className="absolute -top-1.5 -right-1.5 flex size-4 items-center justify-center rounded-full bg-warning text-white"
                title={record.map((r) => RECORD_LABEL[r]).join(', ')}
                aria-hidden
              >
                <Trophy className="size-2.5" strokeWidth={3} />
              </motion.span>
            )}
          </AnimatePresence>
        </button>

        <button
          type="button"
          onClick={onCopyPrevious}
          disabled={!previous}
          aria-label={
            previous ? `Прошлый раз ${formatHint(kind, previous)}. Подставить` : 'Прошлого раза нет'
          }
          className="min-w-0 truncate text-left font-rounded text-subhead text-label-2 tabular disabled:text-label-3"
        >
          {formatHint(kind, previous)}
        </button>

        {fields.map((f) => {
          const active = activeField === f.field
          const value = set[f.field]
          const shown =
            active && draftText !== null && draftText !== ''
              ? draftText
              : formatCell(f.field, value)
          const placeholder = formatCell(f.field, fill?.[f.field])
          return (
            <button
              key={f.field}
              type="button"
              onClick={() => {
                onCell(f.field)
              }}
              aria-label={`${f.title}: ${shown || 'пусто'}`}
              className={clsx(
                'relative flex h-10 items-center justify-center rounded-[0.75rem] font-rounded text-body font-semibold tabular transition-[background-color,box-shadow]',
                active
                  ? 'bg-surface shadow-[0_0_0_2px_var(--accent)] dark:bg-surface-3'
                  : done
                    ? 'bg-transparent'
                    : 'bg-fill-3',
              )}
            >
              {shown ? <span>{shown}</span> : <span className="text-label-3">{placeholder}</span>}
              {active && (
                <span
                  className="ml-px h-5 w-0.5 animate-pulse rounded-full bg-accent"
                  aria-hidden
                />
              )}
            </button>
          )
        })}

        {past ? (
          <span aria-hidden />
        ) : (
          <button
            type="button"
            onClick={onToggle}
            aria-label={done ? 'Снять отметку' : 'Подход выполнен'}
            aria-pressed={done}
            className={clsx(
              'flex size-9 press-scale items-center justify-center rounded-[0.75rem] transition-colors',
              done ? 'bg-success text-white' : 'bg-fill-2 text-label-3',
            )}
          >
            <Check className="size-5" strokeWidth={3} />
          </button>
        )}
      </div>
    </SwipeRow>
  )
}
