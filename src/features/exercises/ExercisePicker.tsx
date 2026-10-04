import clsx from 'clsx'
import { Check, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useExercises, useRecentExerciseIds } from '@/db/hooks'
import { EQUIPMENT_LABEL, MUSCLE_LABEL, MUSCLES } from '@/domain/labels'
import { sameName, searchItems } from '@/domain/search'
import type { Exercise, MuscleGroup } from '@/domain/types'
import { MuscleDot } from '@/ui/MuscleDot'
import { SearchField } from '@/ui/SearchField'
import { Sheet } from '@/ui/Sheet'
import { ExerciseFormSheet } from './ExerciseFormSheet'

interface Props {
  open: boolean
  onClose: () => void
  onPick: (ids: string[]) => void
  /** Выбор нескольких сразу (добавить в тренировку) или одного (заменить). */
  multiple?: boolean
  title?: string
}

export function ExercisePicker(props: Props) {
  return (
    <Sheet
      open={props.open}
      onClose={props.onClose}
      height="full"
      bare
      label={props.title ?? 'Упражнения'}
    >
      <PickerBody {...props} />
    </Sheet>
  )
}

function PickerBody({ onClose, onPick, multiple = true, title = 'Упражнения' }: Props) {
  const exercises = useExercises()
  const recent = useRecentExerciseIds(8)
  const [query, setQuery] = useState('')
  const [muscle, setMuscle] = useState<MuscleGroup | 'all'>('all')
  const [selected, setSelected] = useState<string[]>([])
  const [creating, setCreating] = useState(false)

  const visible = useMemo(() => (exercises ?? []).filter((e) => !e.archivedAt), [exercises])
  const byId = useMemo(() => new Map(visible.map((e) => [e.id, e])), [visible])
  const filtered = useMemo(() => {
    const pool = muscle === 'all' ? visible : visible.filter((e) => e.muscle === muscle)
    return searchItems(pool, query, (e) => e.name)
  }, [visible, muscle, query])
  const exact = query.trim() !== '' && visible.some((e) => sameName(e.name, query))

  function toggle(id: string) {
    if (!multiple) {
      onPick([id])
      onClose()
      return
    }
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  }

  function confirm() {
    if (selected.length === 0) return
    onPick(selected)
    onClose()
  }

  const showRecent = query.trim() === '' && muscle === 'all' && (recent?.length ?? 0) > 0
  const groups = useMemo(() => {
    if (query.trim() !== '') return [{ key: 'results', title: null, items: filtered }]
    return MUSCLES.map((m) => ({
      key: m,
      title: MUSCLE_LABEL[m],
      items: filtered.filter((e) => e.muscle === m),
    })).filter((g) => g.items.length > 0)
  }, [filtered, query])

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0">
        <div className="mx-auto mt-2 h-[0.3125rem] w-9 rounded-full bg-fill" aria-hidden />
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 pt-2 pb-2">
          <button
            type="button"
            onClick={onClose}
            className="justify-self-start text-body text-accent"
          >
            Отмена
          </button>
          <h2 className="truncate text-center text-body font-semibold">{title}</h2>
          {multiple ? (
            <button
              type="button"
              onClick={confirm}
              disabled={selected.length === 0}
              className="justify-self-end text-body font-semibold whitespace-nowrap text-accent disabled:opacity-40"
            >
              {selected.length > 0 ? `Добавить ${selected.length}` : 'Добавить'}
            </button>
          ) : (
            <span />
          )}
        </div>
        <div className="px-4 pb-2">
          <SearchField value={query} onChange={setQuery} placeholder="Поиск упражнения" />
        </div>
        <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-3">
          <FilterChip
            active={muscle === 'all'}
            onClick={() => {
              setMuscle('all')
            }}
          >
            Все
          </FilterChip>
          {MUSCLES.map((m) => (
            <FilterChip
              key={m}
              active={muscle === m}
              onClick={() => {
                setMuscle(m)
              }}
            >
              <MuscleDot muscle={m} />
              {MUSCLE_LABEL[m]}
            </FilterChip>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[calc(var(--safe-bottom)+1rem)]">
        {query.trim() !== '' && !exact && (
          <button
            type="button"
            onClick={() => {
              setCreating(true)
            }}
            className="mx-4 mb-3 flex w-[calc(100%-2rem)] items-center gap-3 rounded-[var(--radius-cell)] pressable bg-accent-soft px-4 py-3 text-left text-accent"
          >
            <Plus className="size-5 shrink-0" strokeWidth={2.4} />
            <span className="min-w-0 flex-1 truncate font-semibold">Создать «{query.trim()}»</span>
          </button>
        )}

        {showRecent && recent && (
          <Group title="Недавние">
            {recent
              .map((id) => byId.get(id))
              .filter((e): e is Exercise => e !== undefined)
              .map((e) => (
                <PickRow
                  key={`r-${e.id}`}
                  exercise={e}
                  selected={selected.includes(e.id)}
                  multiple={multiple}
                  onClick={() => {
                    toggle(e.id)
                  }}
                />
              ))}
          </Group>
        )}

        {groups.map((g) => (
          <Group key={g.key} title={g.title}>
            {g.items.map((e) => (
              <PickRow
                key={e.id}
                exercise={e}
                selected={selected.includes(e.id)}
                multiple={multiple}
                onClick={() => {
                  toggle(e.id)
                }}
              />
            ))}
          </Group>
        ))}

        {filtered.length === 0 && (
          <p className="px-8 py-10 text-center text-subhead text-label-2">
            Ничего не нашлось. Можно создать своё упражнение — кнопка выше.
          </p>
        )}
      </div>

      <ExerciseFormSheet
        open={creating}
        onClose={() => {
          setCreating(false)
        }}
        initialName={query.trim()}
        onSaved={(id) => {
          setQuery('')
          toggle(id)
        }}
        onPickExisting={(id) => {
          setQuery('')
          toggle(id)
        }}
      />
    </div>
  )
}

function Group({ title, children }: { title: string | null; children: React.ReactNode }) {
  return (
    <section className="mb-4">
      {title && <h3 className="px-5 pb-1.5 text-footnote font-semibold text-label-2">{title}</h3>}
      <div className="mx-4 overflow-hidden rounded-[var(--radius-card)] bg-surface-2/60 dark:bg-surface-2">
        {children}
      </div>
    </section>
  )
}

function PickRow({
  exercise,
  selected,
  multiple,
  onClick,
}: {
  exercise: Exercise
  selected: boolean
  multiple: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={multiple ? selected : undefined}
      className="flex w-full items-center gap-3 pressable pl-4 text-left [&+&>span:last-child]:hairline-t"
    >
      <MuscleDot muscle={exercise.muscle} size={10} />
      <span className="flex min-h-[3.25rem] min-w-0 flex-1 items-center gap-3 py-2 pr-4">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-body">{exercise.name}</span>
          <span className="block truncate text-footnote text-label-2">
            {EQUIPMENT_LABEL[exercise.equipment]}
            {exercise.custom ? ' · своё' : ''}
          </span>
        </span>
        {multiple && (
          <span
            className={clsx(
              'flex size-6 shrink-0 items-center justify-center rounded-full transition-colors',
              selected ? 'bg-accent text-on-accent' : 'shadow-[inset_0_0_0_1.5px_var(--label-3)]',
            )}
            aria-hidden
          >
            {selected && <Check className="size-4" strokeWidth={3} />}
          </span>
        )}
      </span>
    </button>
  )
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={clsx(
        'inline-flex h-8 shrink-0 press-scale items-center gap-1.5 rounded-full px-3.5 text-subhead font-medium transition-colors',
        active ? 'bg-label text-surface' : 'bg-fill-3 text-label',
      )}
    >
      {children}
    </button>
  )
}
