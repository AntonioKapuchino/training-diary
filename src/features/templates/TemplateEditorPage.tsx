import clsx from 'clsx'
import { Copy, Ellipsis, Play, Plus, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router'
import { useActiveWorkout, useExerciseMap, useTemplate } from '@/db/hooks'
import {
  createTemplate,
  deleteTemplate,
  duplicateTemplate,
  restoreTemplate,
  updateTemplate,
} from '@/db/templates'
import { lastSession } from '@/db/workouts'
import { formatClock, formatNumber, parseDecimal, parseDurationInput } from '@/domain/format'
import { newId } from '@/domain/ids'
import { SET_TYPE_BADGE, SET_TYPE_LABEL, SET_TYPES } from '@/domain/labels'
import {
  defaultSetCount,
  fieldsFor,
  isWorking,
  pickValues,
  toTemplateSet,
  type FieldSpec,
} from '@/domain/sets'
import type { Exercise, SetType, Template, TemplateExercise, TemplateSet } from '@/domain/types'
import { ActionSheet, type Action } from '@/ui/ActionSheet'
import { Button, IconButton } from '@/ui/Button'
import { Section } from '@/ui/List'
import { MuscleDot } from '@/ui/MuscleDot'
import { Page } from '@/ui/Page'
import { SwipeRow } from '@/ui/SwipeRow'
import { toast } from '@/ui/Toast'
import { ExercisePicker } from '../exercises/ExercisePicker'
import { begin } from '../today/StartSheet'
import { workoutUi } from '../workout/store'
import { useTemplateUses } from './TemplatesPage'

/** Редактор программы. Изменения сохраняются сами, как в «Заметках». */
export function TemplateEditorPage() {
  const { id } = useParams()
  const isNew = id === 'new'
  const template = useTemplate(isNew ? undefined : id)
  if (!isNew && template === null) return <Navigate to="/templates" replace />
  if (!isNew && !template)
    return (
      <Page title="Программа" back inline>
        {null}
      </Page>
    )
  return <Editor key={template?.id ?? 'new'} initial={template ?? undefined} />
}

function Editor({ initial }: { initial: Template | undefined }) {
  const navigate = useNavigate()
  const exercises = useExerciseMap()
  const active = useActiveWorkout()
  const uses = useTemplateUses(initial?.id)
  const [id, setId] = useState(initial?.id)
  const [name, setName] = useState(initial?.name ?? '')
  const [items, setItems] = useState<TemplateExercise[]>(initial?.exercises ?? [])
  const [picker, setPicker] = useState(false)
  const [menu, setMenu] = useState<string | null>(null)
  const [pageMenu, setPageMenu] = useState(false)
  const { schedule, flush, discard } = useTemplateAutosave(initial?.id, setId)

  function rename(next: string) {
    setName(next)
    schedule({ name: next })
  }

  function change(next: TemplateExercise[]) {
    setItems(next)
    schedule({ items: next })
  }

  async function addExercises(ids: string[]) {
    const added: TemplateExercise[] = []
    for (const exerciseId of ids) {
      const ex = exercises?.get(exerciseId)
      if (!ex) continue
      const last = await lastSession(exerciseId)
      const sets: TemplateSet[] =
        last && last.sets.length > 0
          ? last.sets.map(toTemplateSet)
          : Array.from({ length: defaultSetCount(ex.kind) }, () => ({ type: 'normal' as const }))
      added.push({ id: newId(), exerciseId, sets })
    }
    change([...items, ...added])
  }

  function patchItem(itemId: string, fn: (t: TemplateExercise) => TemplateExercise) {
    change(items.map((t) => (t.id === itemId ? fn(t) : t)))
  }

  function move(itemId: string, dir: -1 | 1) {
    const i = items.findIndex((t) => t.id === itemId)
    const j = i + dir
    if (i < 0 || j < 0 || j >= items.length) return
    const next = [...items]
    const [a] = next.splice(i, 1)
    if (a) next.splice(j, 0, a)
    change(next)
  }

  async function remove() {
    // Несохранённые правки удаляемой программы записывать уже незачем.
    discard()
    if (!id) {
      void navigate('/templates', { replace: true })
      return
    }
    const removed = await deleteTemplate(id)
    void navigate('/templates', { replace: true })
    if (removed)
      toast(`«${removed.name}» удалена`, {
        label: 'Вернуть',
        onAction: () => void restoreTemplate(removed),
      })
  }

  const menuItem = menu ? items.find((t) => t.id === menu) : undefined
  const menuIndex = menuItem ? items.indexOf(menuItem) : -1
  const itemActions: Action[] = menuItem
    ? [
        ...(menuIndex > 0
          ? [
              {
                label: 'Выше',
                onSelect: () => {
                  move(menuItem.id, -1)
                },
              },
            ]
          : []),
        ...(menuIndex < items.length - 1
          ? [
              {
                label: 'Ниже',
                onSelect: () => {
                  move(menuItem.id, 1)
                },
              },
            ]
          : []),
        {
          label: 'Убрать из программы',
          destructive: true,
          onSelect: () => {
            change(items.filter((t) => t.id !== menuItem.id))
          },
        },
      ]
    : []

  return (
    <Page
      title={name.trim() || 'Новая программа'}
      back="/templates"
      inline
      tabbar={false}
      actions={
        id ? (
          <IconButton
            label="Действия"
            onClick={() => {
              setPageMenu(true)
            }}
          >
            <Ellipsis className="size-5" strokeWidth={2.4} />
          </IconButton>
        ) : undefined
      }
    >
      <div className="px-4 pt-2">
        <TitleInput value={name} autoFocus={!initial} onChange={rename} onDone={flush} />
        {uses !== undefined && uses > 0 && (
          <p className="mt-1 text-footnote text-label-2">Тренировок по программе: {uses}</p>
        )}
      </div>

      <div className="mt-4 space-y-3 px-4">
        {items.map((item) => {
          const ex = exercises?.get(item.exerciseId)
          if (!ex) return null
          return (
            <ItemCard
              key={item.id}
              item={item}
              exercise={ex}
              onChange={(next) => {
                patchItem(item.id, () => next)
              }}
              onMenu={() => {
                setMenu(item.id)
              }}
            />
          )
        })}
        <button
          type="button"
          onClick={() => {
            setPicker(true)
          }}
          className="flex h-[3.25rem] w-full press-scale items-center justify-center gap-2 rounded-full bg-accent-soft text-body font-semibold text-accent"
        >
          <Plus className="size-5" strokeWidth={2.6} /> Добавить упражнение
        </button>
      </div>

      {id && items.length > 0 && (
        <Section plain>
          <Button
            block
            size="lg"
            icon={<Play className="size-5 fill-current" />}
            onClick={() => {
              if (active) workoutUi.open()
              else void begin({ templateId: id })
            }}
          >
            {active ? 'Идёт тренировка — открыть' : 'Начать тренировку'}
          </Button>
        </Section>
      )}

      <ExercisePicker
        open={picker}
        title="Добавить в программу"
        onClose={() => {
          setPicker(false)
        }}
        onPick={(ids) => void addExercises(ids)}
      />
      <ActionSheet
        open={menuItem !== undefined}
        onClose={() => {
          setMenu(null)
        }}
        title={menuItem ? exercises?.get(menuItem.exerciseId)?.name : undefined}
        actions={itemActions}
      />
      <ActionSheet
        open={pageMenu}
        onClose={() => {
          setPageMenu(false)
        }}
        title={name || 'Программа'}
        actions={[
          {
            label: 'Дублировать',
            icon: <Copy className="size-5" />,
            onSelect: () => {
              if (id)
                void duplicateTemplate(id).then((copy) => {
                  if (copy) void navigate(`/templates/${copy}`, { replace: true })
                })
            },
          },
          {
            label: 'Удалить программу',
            icon: <Trash2 className="size-5" />,
            destructive: true,
            onSelect: () => void remove(),
          },
        ]}
      />
    </Page>
  )
}

/**
 * Автосохранение, как в «Заметках»: правки пишутся через 350 мс тишины, а незаписанное —
 * при уходе со страницы и при сворачивании приложения. Новая программа создаётся при
 * первой правке; адрес страницы при этом не меняется — иначе страница перерисовалась бы
 * целиком и клавиатура закрылась бы посреди набора названия.
 */
function useTemplateAutosave(initialId: string | undefined, onCreated: (id: string) => void) {
  const pending = useRef<{ name?: string; items?: TemplateExercise[] }>({})
  const latest = useRef<{ name: string; items: TemplateExercise[] } | null>(null)
  const id = useRef(initialId)
  const creating = useRef<Promise<string> | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const created = useRef(onCreated)
  useLayoutEffect(() => {
    created.current = onCreated
  })

  const flush = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = undefined
    const patch = pending.current
    if (patch.name === undefined && patch.items === undefined) return
    pending.current = {}
    const state = latest.current
    if (!state) return
    const title = state.name.trim() || 'Без названия'
    if (!id.current && creating.current) id.current = await creating.current
    if (id.current) {
      await updateTemplate(id.current, { name: title, exercises: state.items })
      return
    }
    if (!state.name.trim() && state.items.length === 0) return
    creating.current = createTemplate(title, state.items)
    id.current = await creating.current
    created.current(id.current)
  }, [])

  const schedule = useCallback(
    (patch: { name?: string; items?: TemplateExercise[] }) => {
      pending.current = { ...pending.current, ...patch }
      latest.current = {
        name: patch.name ?? latest.current?.name ?? '',
        items: patch.items ?? latest.current?.items ?? [],
      }
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => void flush(), 350)
    },
    [flush],
  )

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') void flush()
    }
    document.addEventListener('visibilitychange', onHide)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      void flush()
    }
  }, [flush])

  const discard = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = undefined
    pending.current = {}
  }, [])

  return { schedule, flush, discard }
}

/** Название программы крупным заголовком: длинное переносится, а не уезжает за край. */
function TitleInput({
  value,
  autoFocus,
  onChange,
  onDone,
}: {
  value: string
  autoFocus: boolean
  onChange: (v: string) => void
  onDone: () => void
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = '0px'
    el.style.height = `${String(el.scrollHeight)}px`
  }, [value])
  return (
    <textarea
      ref={ref}
      value={value}
      rows={1}
      autoFocus={autoFocus}
      enterKeyHint="done"
      onChange={(e) => {
        onChange(e.target.value.replace(/\s*\n\s*/g, ' '))
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          e.currentTarget.blur()
          onDone()
        }
      }}
      placeholder="Название программы"
      aria-label="Название программы"
      className="block w-full resize-none overflow-hidden bg-transparent text-title-1 font-bold outline-none placeholder:text-label-3"
    />
  )
}

/** Упражнение программы: подходы с целевыми значениями. */
function ItemCard({
  item,
  exercise,
  onChange,
  onMenu,
}: {
  item: TemplateExercise
  exercise: Exercise
  onChange: (t: TemplateExercise) => void
  onMenu: () => void
}) {
  const fields = fieldsFor(exercise.kind)
  let n = 0
  const setSet = (i: number, s: TemplateSet) => {
    onChange({ ...item, sets: item.sets.map((x, j) => (j === i ? s : x)) })
  }
  return (
    <article className="overflow-hidden rounded-[var(--radius-card)] bg-surface shadow-[var(--shadow-card)]">
      <header className="flex items-center gap-2 px-4 pt-3.5 pb-2">
        <MuscleDot muscle={exercise.muscle} size={10} />
        <h3 className="min-w-0 flex-1 truncate text-body font-semibold">{exercise.name}</h3>
        <button
          type="button"
          onClick={onMenu}
          aria-label={`Действия: ${exercise.name}`}
          className="flex size-9 press-scale items-center justify-center rounded-full bg-fill-3 text-accent"
        >
          <Ellipsis className="size-5" strokeWidth={2.4} />
        </button>
      </header>
      <div
        className="grid grid-cols-[2rem_repeat(var(--cols),minmax(0,1fr))_2rem] items-center gap-x-2 px-3 pb-1 text-caption-2 font-semibold text-label-2 uppercase"
        style={{ ['--cols' as string]: fields.length }}
        aria-hidden
      >
        <span className="text-center">#</span>
        {fields.map((f) => (
          <span key={f.field} className="text-center">
            {f.label}
          </span>
        ))}
        <span />
      </div>
      {item.sets.map((s, i) => {
        const num = isWorking(s) ? ++n : 0
        return (
          <SwipeRow
            key={`${item.id}-${String(i)}`}
            onDelete={() => {
              onChange({ ...item, sets: item.sets.filter((_, j) => j !== i) })
            }}
          >
            <div
              className="grid grid-cols-[2rem_repeat(var(--cols),minmax(0,1fr))_2rem] items-center gap-x-2 px-3 py-1"
              style={{ ['--cols' as string]: fields.length }}
            >
              <TypeBadge
                type={s.type}
                number={num}
                onChange={(type) => {
                  setSet(i, { ...s, type })
                }}
              />
              {fields.map((f) => (
                <TargetInput
                  key={f.field}
                  spec={f}
                  value={s[f.field]}
                  onChange={(v) => {
                    setSet(i, { type: s.type, ...pickValues({ ...s, [f.field]: v }) })
                  }}
                />
              ))}
              <button
                type="button"
                aria-label="Удалить подход"
                onClick={() => {
                  onChange({ ...item, sets: item.sets.filter((_, j) => j !== i) })
                }}
                className="flex size-8 items-center justify-center text-label-3"
              >
                <X className="size-4" strokeWidth={2.4} />
              </button>
            </div>
          </SwipeRow>
        )
      })}
      <button
        type="button"
        onClick={() => {
          const last = item.sets.at(-1)
          onChange({
            ...item,
            sets: [
              ...item.sets,
              last ? { ...last, type: isWorking(last) ? last.type : 'normal' } : { type: 'normal' },
            ],
          })
        }}
        className="flex h-11 w-full items-center justify-center gap-1.5 pressable text-subhead font-semibold text-accent"
      >
        <Plus className="size-4" strokeWidth={2.6} /> Подход
      </button>
    </article>
  )
}

function TypeBadge({
  type,
  number,
  onChange,
}: {
  type: SetType
  number: number
  onChange: (t: SetType) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true)
        }}
        aria-label={`${SET_TYPE_LABEL[type]}. Изменить`}
        className={clsx(
          'flex h-8 w-8 items-center justify-center rounded-[0.625rem] font-rounded text-subhead font-semibold',
          type === 'warmup' &&
            'bg-[color-mix(in_srgb,var(--warning)_18%,transparent)] text-warning',
          type === 'drop' && 'bg-accent-soft text-accent',
          type === 'failure' && 'bg-danger-soft text-danger',
          type === 'normal' && 'text-label-2',
        )}
      >
        {SET_TYPE_BADGE[type] || number}
      </button>
      <ActionSheet
        open={open}
        onClose={() => {
          setOpen(false)
        }}
        title="Тип подхода"
        actions={SET_TYPES.map((t) => ({
          label: SET_TYPE_LABEL[t],
          onSelect: () => {
            onChange(t)
          },
        }))}
      />
    </>
  )
}

/** Целевое значение: системная цифровая клавиатура, запятая и точка — обе годятся. */
function TargetInput({
  spec,
  value,
  onChange,
}: {
  spec: FieldSpec
  value: number | undefined
  onChange: (v: number | undefined) => void
}) {
  const shown = value === undefined ? '' : spec.duration ? formatClock(value) : formatNumber(value)
  const [text, setText] = useState(shown)
  const [focused, setFocused] = useState(false)
  return (
    <input
      value={focused ? text : shown}
      inputMode={spec.decimals > 0 ? 'decimal' : 'numeric'}
      placeholder={spec.duration ? 'м:сс' : '—'}
      aria-label={spec.title}
      onFocus={(e) => {
        setFocused(true)
        setText(shown)
        e.target.select()
      }}
      onBlur={() => {
        setFocused(false)
      }}
      onChange={(e) => {
        const raw = e.target.value
        setText(raw)
        if (spec.duration) {
          if (!raw.trim()) onChange(undefined)
          else {
            const sec = parseDurationInput(raw)
            if (sec !== undefined) onChange(sec)
          }
          return
        }
        const v = parseDecimal(raw)
        if (raw.trim() === '') onChange(undefined)
        else if (v !== undefined) onChange(spec.decimals === 0 ? Math.round(v) : v)
      }}
      className="h-10 w-full min-w-0 rounded-[0.75rem] bg-fill-3 text-center font-rounded text-body font-semibold tabular outline-none placeholder:font-normal placeholder:text-label-3 focus:bg-surface focus:shadow-[0_0_0_2px_var(--accent)]"
    />
  )
}
