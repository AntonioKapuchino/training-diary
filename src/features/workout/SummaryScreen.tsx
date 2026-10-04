import clsx from 'clsx'
import { useLiveQuery } from 'dexie-react-hooks'
import { CircleCheck, Trophy } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { useExerciseMap, useTemplate, useWorkout } from '@/db/hooks'
import { templateFromWorkout, updateTemplateFromWorkout } from '@/db/templates'
import { updateWorkout, workoutRecords } from '@/db/workouts'
import { formatWeekdayDayMonth, todayISO } from '@/domain/dates'
import { formatDuration, volumeParts } from '@/domain/format'
import { RECORD_LABEL } from '@/domain/records'
import { workoutSeconds } from '@/domain/stats'
import { confetti } from '@/lib/confetti'
import { haptic } from '@/lib/haptics'
import { useDebouncedSave } from '@/lib/useDebouncedSave'
import { Button } from '@/ui/Button'
import { MuscleDot } from '@/ui/MuscleDot'
import { toast } from '@/ui/Toast'
import { RATINGS } from './ratings'
import { useWorkoutUi, workoutUi } from './store'

/** Итоги сразу после тренировки: цифры, рекорды, самочувствие. */
export function SummaryScreen() {
  const { summary } = useWorkoutUi()
  return <AnimatePresence>{summary && <Summary key={summary} id={summary} />}</AnimatePresence>
}

function Summary({ id }: { id: string }) {
  const workout = useWorkout(id)
  const exercises = useExerciseMap()
  const records = useLiveQuery(() => workoutRecords(id), [id])
  const template = useTemplate(workout?.templateId)
  const navigate = useNavigate()
  const celebrated = useRef(false)
  const [saved, setSaved] = useState<'template' | 'updated' | null>(null)
  const note = useDebouncedSave((v) => void updateWorkout(id, { note: v }))

  const recordCount = records?.length ?? 0
  useEffect(() => {
    if (recordCount > 0 && !celebrated.current) {
      celebrated.current = true
      confetti()
    }
  }, [recordCount])

  if (!workout) return null
  const summary = workout.summary
  const seconds = workoutSeconds(workout)

  function close(openDetail: boolean) {
    note.flush()
    workoutUi.closeSummary()
    if (openDetail) void navigate(`/history/${id}`)
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-bg"
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 380, damping: 34 }}
      role="dialog"
      aria-label="Итоги тренировки"
    >
      <div className="mx-auto flex min-h-full max-w-[32rem] flex-col px-5 pt-[calc(var(--safe-top)+2.5rem)] pb-[calc(var(--safe-bottom)+1.5rem)]">
        <motion.div
          initial={{ scale: 0.4, rotate: -12, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 14, delay: 0.1 }}
          className={clsx(
            'mx-auto flex size-20 items-center justify-center rounded-full',
            recordCount > 0
              ? 'bg-[color-mix(in_srgb,var(--warning)_18%,transparent)] text-warning'
              : 'bg-success-soft text-success',
          )}
        >
          {recordCount > 0 ? <Trophy className="size-10" /> : <CircleCheck className="size-10" />}
        </motion.div>
        <h1 className="mt-5 text-center text-title-1 font-bold">
          {recordCount > 0 ? 'Новые рекорды!' : 'Тренировка завершена'}
        </h1>
        <p className="mt-1 text-center text-subhead text-label-2">
          {workout.title ?? 'Тренировка'} · {formatWeekdayDayMonth(workout.date, todayISO())}
        </p>

        <div className="mt-6 grid grid-cols-3 gap-2.5">
          <Tile label="Время" value={seconds > 0 ? formatDuration(seconds) : '—'} />
          <Tile
            label={`Объём, ${volumeParts(summary?.volume ?? 0).unit}`}
            value={summary && summary.volume > 0 ? volumeParts(summary.volume).value : '—'}
          />
          <Tile label="Подходы" value={String(summary?.sets ?? 0)} />
        </div>

        {records && records.length > 0 && exercises && (
          <section className="mt-6">
            <h2 className="mb-2 px-1 text-footnote font-semibold text-label-2">Рекорды</h2>
            <div className="overflow-hidden rounded-[var(--radius-card)] bg-surface">
              {records.map((r, i) => {
                const ex = exercises.get(r.exerciseId)
                if (!ex) return null
                return (
                  <motion.div
                    key={r.setId}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.25 + i * 0.06 }}
                    className={clsx('flex items-center gap-3 px-4 py-3', i > 0 && 'hairline-t')}
                  >
                    <Trophy className="size-5 shrink-0 text-warning" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2 text-body">
                        <MuscleDot muscle={ex.muscle} /> <span className="truncate">{ex.name}</span>
                      </span>
                      <span className="block text-footnote text-label-2">
                        {r.types.map((t) => RECORD_LABEL[t].toLowerCase()).join(', ')}
                      </span>
                    </span>
                  </motion.div>
                )
              })}
            </div>
          </section>
        )}

        <section className="mt-6">
          <h2 className="mb-2 px-1 text-footnote font-semibold text-label-2">Как самочувствие?</h2>
          <div className="grid grid-cols-5 gap-2">
            {RATINGS.map((r) => (
              <button
                key={r.value}
                type="button"
                aria-label={r.label}
                aria-pressed={workout.rating === r.value}
                onClick={() => {
                  haptic()
                  void updateWorkout(id, { rating: workout.rating === r.value ? null : r.value })
                }}
                className={clsx(
                  'flex h-14 press-scale flex-col items-center justify-center rounded-[var(--radius-cell)] text-[1.625rem] transition-colors',
                  workout.rating === r.value
                    ? 'bg-accent-soft shadow-[inset_0_0_0_2px_var(--accent)]'
                    : 'bg-surface',
                )}
              >
                {r.emoji}
              </button>
            ))}
          </div>
          <textarea
            defaultValue={workout.note ?? ''}
            onChange={(e) => {
              note.change(e.target.value)
            }}
            onBlur={note.flush}
            rows={2}
            placeholder="Заметка: сон, самочувствие, что получилось"
            className="mt-2.5 w-full resize-none rounded-[var(--radius-card)] bg-surface px-4 py-3 text-body outline-none placeholder:text-label-3"
          />
        </section>

        <div className="mt-auto space-y-2.5 pt-6">
          {template && saved !== 'updated' && (
            <Button
              variant="tinted"
              block
              size="lg"
              onClick={() =>
                void updateTemplateFromWorkout(template.id, id).then(() => {
                  setSaved('updated')
                  toast(`Программа «${template.name}» обновлена`)
                })
              }
            >
              Обновить программу «{template.name}»
            </Button>
          )}
          {!workout.templateId && saved !== 'template' && (
            <Button
              variant="tinted"
              block
              size="lg"
              onClick={() =>
                void templateFromWorkout(id, workout.title ?? 'Моя программа').then(() => {
                  setSaved('template')
                  toast('Сохранено в программы')
                })
              }
            >
              Сохранить как программу
            </Button>
          )}
          <Button
            block
            size="lg"
            onClick={() => {
              close(false)
            }}
          >
            Готово
          </Button>
          <button
            type="button"
            className="h-11 w-full text-subhead font-semibold text-accent"
            onClick={() => {
              close(true)
            }}
          >
            Подробнее
          </button>
        </div>
      </div>
    </motion.div>
  )
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-cell)] bg-surface px-3 py-3 text-center">
      <div className="font-rounded text-title-3 font-bold">{value}</div>
      <div className="mt-0.5 text-caption text-label-2">{label}</div>
    </div>
  )
}
