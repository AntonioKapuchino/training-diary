import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowDownUp, ChevronRight, ClipboardList, Play, Plus } from 'lucide-react'
import { Reorder } from 'motion/react'
import { useState } from 'react'
import { Link } from 'react-router'
import { db } from '@/db/db'
import { useActiveWorkout, useExerciseMap, useTemplates } from '@/db/hooks'
import { reorderTemplates } from '@/db/templates'
import { dateOf, formatAgo } from '@/domain/dates'
import type { Template } from '@/domain/types'
import { Button, ButtonLink, IconButton } from '@/ui/Button'
import { EmptyState } from '@/ui/EmptyState'
import { MuscleDots } from '@/ui/MuscleDot'
import { Page } from '@/ui/Page'
import { Sheet } from '@/ui/Sheet'
import { begin } from '../today/StartSheet'
import { workoutUi } from '../workout/store'

export function TemplatesPage() {
  const templates = useTemplates()
  const exercises = useExerciseMap()
  const active = useActiveWorkout()
  const [ordering, setOrdering] = useState(false)

  return (
    <Page
      title="Программы"
      back="/"
      subtitle="Готовый набор упражнений — тренировка начинается одним касанием"
      actions={
        <>
          {templates && templates.length > 1 && (
            <IconButton
              label="Порядок"
              onClick={() => {
                setOrdering(true)
              }}
            >
              <ArrowDownUp className="size-5" />
            </IconButton>
          )}
          <Link
            to="/templates/new"
            aria-label="Новая программа"
            className="flex size-11 press-scale items-center justify-center rounded-full glass"
          >
            <Plus className="size-5" strokeWidth={2.4} />
          </Link>
        </>
      }
    >
      {templates?.length === 0 && (
        <EmptyState
          icon={<ClipboardList />}
          title="Программ пока нет"
          message="Собери программу с нуля или сохрани любую тренировку из истории как программу."
          action={<ButtonLink to="/templates/new">Создать программу</ButtonLink>}
        />
      )}

      <div className="space-y-3 px-4">
        {(templates ?? []).map((t) => {
          const items = t.exercises.flatMap((e) => {
            const ex = exercises?.get(e.exerciseId)
            return ex ? [ex] : []
          })
          return (
            <div
              key={t.id}
              className="flex items-stretch overflow-hidden rounded-[var(--radius-card)] bg-surface shadow-[var(--shadow-card)]"
            >
              <Link to={`/templates/${t.id}`} className="min-w-0 flex-1 pressable px-4 py-3.5">
                <span className="flex items-center gap-2">
                  <span className="truncate text-body font-semibold">{t.name}</span>
                  <ChevronRight
                    className="size-4 shrink-0 text-label-3"
                    strokeWidth={2.5}
                    aria-hidden
                  />
                </span>
                <span className="mt-1 flex items-center gap-2 text-footnote text-label-2">
                  <MuscleDots muscles={[...new Set(items.map((e) => e.muscle))]} />
                  {t.lastUsedAt ? `была ${formatAgo(dateOf(t.lastUsedAt))}` : 'ещё не было'}
                </span>
                <span className="mt-1.5 line-clamp-2 text-footnote text-label-2">
                  {items.length > 0 ? items.map((e) => e.name).join(' · ') : 'Без упражнений'}
                </span>
              </Link>
              <button
                type="button"
                aria-label={`Начать: ${t.name}`}
                disabled={t.exercises.length === 0}
                onClick={() => {
                  if (active) workoutUi.open()
                  else void begin({ templateId: t.id })
                }}
                className="flex w-16 shrink-0 press-scale items-center justify-center text-accent disabled:text-label-3"
              >
                <span className="flex size-10 items-center justify-center rounded-full bg-accent-soft">
                  <Play className="size-5 fill-current" />
                </span>
              </button>
            </div>
          )
        })}
      </div>

      <OrderSheet
        open={ordering}
        templates={templates ?? []}
        onClose={() => {
          setOrdering(false)
        }}
      />
    </Page>
  )
}

function OrderSheet({
  open,
  templates,
  onClose,
}: {
  open: boolean
  templates: Template[]
  onClose: () => void
}) {
  return (
    <Sheet open={open} onClose={onClose} title="Порядок программ">
      <OrderList templates={templates} onClose={onClose} />
    </Sheet>
  )
}

function OrderList({ templates, onClose }: { templates: Template[]; onClose: () => void }) {
  const [order, setOrder] = useState(() => templates.map((t) => t.id))
  const byId = new Map(templates.map((t) => [t.id, t]))
  return (
    <div className="px-4 pb-5">
      <Reorder.Group axis="y" values={order} onReorder={setOrder} className="space-y-2">
        {order.map((id) => (
          <Reorder.Item
            key={id}
            value={id}
            className="flex cursor-grab items-center gap-3 rounded-[var(--radius-cell)] bg-fill-3 px-4 py-3.5 active:cursor-grabbing"
            whileDrag={{ scale: 1.03, boxShadow: '0 10px 30px rgb(0 0 0 / 0.18)' }}
          >
            <ArrowDownUp className="size-4 text-label-3" aria-hidden />
            <span className="truncate text-body">{byId.get(id)?.name}</span>
          </Reorder.Item>
        ))}
      </Reorder.Group>
      <Button
        block
        size="lg"
        className="mt-4"
        onClick={() => {
          void reorderTemplates(order)
          onClose()
        }}
      >
        Готово
      </Button>
    </div>
  )
}

/** Сколько раз программу использовали — для подписи в редакторе. */
export function useTemplateUses(templateId: string | undefined): number | undefined {
  return useLiveQuery(
    async () =>
      templateId
        ? (await db.workouts.toArray()).filter(
            (w) => w.templateId === templateId && w.status === 'done',
          ).length
        : 0,
    [templateId],
  )
}
