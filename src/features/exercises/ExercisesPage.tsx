import clsx from 'clsx'
import { useLiveQuery } from 'dexie-react-hooks'
import { Archive, ChevronRight, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { db } from '@/db/db'
import { useExercises } from '@/db/hooks'
import { dateOf, formatAgo } from '@/domain/dates'
import { EQUIPMENT_LABEL, MUSCLE_LABEL, MUSCLES } from '@/domain/labels'
import { searchItems } from '@/domain/search'
import type { Exercise, MuscleGroup } from '@/domain/types'
import { useSessionState } from '@/lib/sessionState'
import { IconButton } from '@/ui/Button'
import { Section } from '@/ui/List'
import { MuscleDot } from '@/ui/MuscleDot'
import { Page } from '@/ui/Page'
import { SearchField } from '@/ui/SearchField'
import { ExerciseFormSheet } from './ExerciseFormSheet'

/** Когда упражнение делали в последний раз и сколько раз — по завершённым тренировкам. */
function useUsage() {
  return useLiveQuery(async () => {
    const [entries, workouts] = await Promise.all([
      db.entries.toArray(),
      db.workouts.where('status').equals('done').toArray(),
    ])
    const done = new Set(workouts.map((w) => w.id))
    const usage = new Map<string, { last: number; sessions: Set<string> }>()
    for (const e of entries) {
      if (!done.has(e.workoutId) || !e.sets.some((s) => s.done)) continue
      const u = usage.get(e.exerciseId) ?? { last: 0, sessions: new Set<string>() }
      u.last = Math.max(u.last, e.startedAt)
      u.sessions.add(e.workoutId)
      usage.set(e.exerciseId, u)
    }
    return usage
  }, [])
}

export function ExercisesPage() {
  const exercises = useExercises()
  const usage = useUsage()
  const [query, setQuery] = useSessionState('exercises.query', '')
  const [muscle, setMuscle] = useSessionState<MuscleGroup | 'all'>('exercises.muscle', 'all')
  const [creating, setCreating] = useState(false)
  const [showArchive, setShowArchive] = useState(false)

  const active = useMemo(() => (exercises ?? []).filter((e) => !e.archivedAt), [exercises])
  const archived = useMemo(() => (exercises ?? []).filter((e) => e.archivedAt), [exercises])
  const filtered = useMemo(() => {
    const pool = muscle === 'all' ? active : active.filter((e) => e.muscle === muscle)
    return searchItems(pool, query, (e) => e.name)
  }, [active, muscle, query])

  const searching = query.trim() !== ''

  return (
    <Page
      title="Упражнения"
      subtitle={exercises ? `${active.length} в каталоге` : undefined}
      actions={
        <IconButton
          label="Новое упражнение"
          onClick={() => {
            setCreating(true)
          }}
        >
          <Plus className="size-5" strokeWidth={2.4} />
        </IconButton>
      }
    >
      <div className="px-4 pt-1 pb-2">
        <SearchField value={query} onChange={setQuery} placeholder="Поиск упражнения" />
      </div>
      <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-1">
        <MuscleChip
          active={muscle === 'all'}
          onClick={() => {
            setMuscle('all')
          }}
        >
          Все
        </MuscleChip>
        {MUSCLES.map((m) => (
          <MuscleChip
            key={m}
            active={muscle === m}
            onClick={() => {
              setMuscle(m)
            }}
          >
            <MuscleDot muscle={m} />
            {MUSCLE_LABEL[m]}
          </MuscleChip>
        ))}
      </div>

      {searching ? (
        <Section className="mt-4">
          {filtered.map((e) => (
            <ExerciseRow key={e.id} exercise={e} last={usage?.get(e.id)?.last} />
          ))}
          {filtered.length === 0 && (
            <button
              type="button"
              className="flex w-full items-center gap-3 pressable px-4 py-3.5 text-left text-accent"
              onClick={() => {
                setCreating(true)
              }}
            >
              <Plus className="size-5" /> Создать «{query.trim()}»
            </button>
          )}
        </Section>
      ) : (
        MUSCLES.map((m) => {
          const items = filtered.filter((e) => e.muscle === m)
          if (items.length === 0) return null
          return (
            <Section key={m} header={MUSCLE_LABEL[m]}>
              {items.map((e) => (
                <ExerciseRow key={e.id} exercise={e} last={usage?.get(e.id)?.last} />
              ))}
            </Section>
          )
        })
      )}

      {!searching && archived.length > 0 && (
        <Section>
          <button
            type="button"
            className="flex w-full items-center gap-3 pressable px-4 py-3 text-left"
            onClick={() => {
              setShowArchive((v) => !v)
            }}
            aria-expanded={showArchive}
          >
            <Archive className="size-5 text-label-2" />
            <span className="flex-1 text-body">Архив</span>
            <span className="text-body text-label-2">{archived.length}</span>
            <ChevronRight
              className={clsx(
                'size-[1.125rem] text-label-3 transition-transform',
                showArchive && 'rotate-90',
              )}
              strokeWidth={2.5}
            />
          </button>
          {showArchive &&
            archived.map((e) => (
              <ExerciseRow key={e.id} exercise={e} last={usage?.get(e.id)?.last} />
            ))}
        </Section>
      )}

      <ExerciseFormSheet
        open={creating}
        initialName={query.trim()}
        onClose={() => {
          setCreating(false)
        }}
        onSaved={() => {
          setQuery('')
        }}
      />
    </Page>
  )
}

function ExerciseRow({ exercise, last }: { exercise: Exercise; last: number | undefined }) {
  return (
    <Link
      to={`/exercises/${exercise.id}`}
      className="flex items-center gap-3 pressable pl-4 [&+&>span]:hairline-t"
    >
      <span className="flex min-h-[3.25rem] min-w-0 flex-1 items-center gap-3 py-2 pr-3">
        <MuscleDot muscle={exercise.muscle} size={10} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-body">{exercise.name}</span>
          <span className="block truncate text-footnote text-label-2">
            {EQUIPMENT_LABEL[exercise.equipment]}
            {exercise.custom ? ' · своё' : ''}
            {last ? ` · ${formatAgo(dateOf(last))}` : ''}
          </span>
        </span>
        <ChevronRight
          className="size-[1.125rem] shrink-0 text-label-3"
          strokeWidth={2.5}
          aria-hidden
        />
      </span>
    </Link>
  )
}

function MuscleChip({
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
        active
          ? 'bg-label text-surface'
          : 'bg-surface text-label shadow-[var(--shadow-card)] dark:bg-fill-3',
      )}
    >
      {children}
    </button>
  )
}
