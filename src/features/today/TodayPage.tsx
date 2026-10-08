import clsx from 'clsx'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  ArrowDownToLine,
  ChevronRight,
  Ellipsis,
  Flame,
  PartyPopper,
  Play,
  Plus,
  Settings2,
  Share,
  X,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { backupDue, backupFile, markExported } from '@/db/backup'
import { db, getMeta, setMeta } from '@/db/db'
import { useActiveWorkout, useDoneWorkouts, useMigrationState, useTemplates } from '@/db/hooks'
import { markMigrationSeen } from '@/db/migrate'
import {
  addMonths,
  dateOf,
  formatAgo,
  formatWeekdayDayMonth,
  monthGenitive,
  parseISODate,
  startOfMonth,
  startOfWeek,
  todayISO,
  weekDays,
  WEEKDAY_SHORT,
} from '@/domain/dates'
import { capitalize, countLabel, formatClock, plural } from '@/domain/format'
import { nextInRotation } from '@/domain/rotation'
import { streakWeeks } from '@/domain/stats'
import type { Template, Workout } from '@/domain/types'
import { backupSavedMessage, shareOrDownload } from '@/lib/share'
import { useNow } from '@/lib/useNow'
import { useSettings } from '@/settings/settings'
import { ActionSheet } from '@/ui/ActionSheet'
import { Button, IconButton } from '@/ui/Button'
import { Ring } from '@/ui/charts/Ring'
import { Section } from '@/ui/List'
import { MuscleDots } from '@/ui/MuscleDot'
import { Page } from '@/ui/Page'
import { toast } from '@/ui/Toast'
import { WorkoutRow } from '../history/WorkoutRow'
import { workoutUi } from '../workout/store'
import { begin, StartSheet } from './StartSheet'

export function TodayPage() {
  const today = todayISO()
  const navigate = useNavigate()
  const workouts = useDoneWorkouts()
  const active = useActiveWorkout()
  const templates = useTemplates()
  const settings = useSettings()
  const [startOpen, setStartOpen] = useState(false)
  const [templateMenu, setTemplateMenu] = useState<Template | null>(null)
  // Программы чередуются по кругу: какая следующая — по последней сделанной.
  const next = useMemo(
    () =>
      templates && workouts && templates.length > 1
        ? nextInRotation(templates, workouts, parseISODate(today).getTime())
        : undefined,
    [templates, workouts, today],
  )

  return (
    <Page
      title="Сегодня"
      subtitle={<span>{capitalize(formatWeekdayDayMonth(today, today))}</span>}
      actions={
        <IconButton label="Настройки" onClick={() => void navigate('/settings')}>
          <Settings2 className="size-5" strokeWidth={2.2} />
        </IconButton>
      }
    >
      <MigrationCard />
      <BackupBanner reminderDays={settings.backupReminderDays} />
      {workouts !== undefined && <MonthCard workouts={workouts} today={today} />}

      {/* До ответа базы кольцо показало бы «Ещё 3 тренировки» — лучше подождать. */}
      {workouts !== undefined && (
        <Section plain>
          <WeekCard dates={workouts.map((w) => w.date)} goal={settings.weeklyGoal} today={today} />
        </Section>
      )}

      <Section plain>
        {active ? (
          <ActiveCard startedAt={active.startedAt} title={active.title} />
        ) : next ? (
          <NextCard
            template={next}
            onStart={() => void begin({ templateId: next.id })}
            onOther={() => {
              setStartOpen(true)
            }}
          />
        ) : (
          <Button
            block
            size="lg"
            icon={<Play className="size-5 fill-current" />}
            onClick={() => {
              setStartOpen(true)
            }}
          >
            Начать тренировку
          </Button>
        )}
      </Section>

      <Section
        title="Программы"
        plain
        action={
          <Link to="/templates" className="text-body text-accent">
            Все
          </Link>
        }
      >
        {templates && templates.length > 0 ? (
          <div className="-mx-4 no-scrollbar flex snap-x gap-3 overflow-x-auto px-4 pb-1">
            {templates.map((t) => (
              <TemplateCard
                key={t.id}
                template={t}
                next={t.id === next?.id}
                onClick={() => {
                  setTemplateMenu(t)
                }}
              />
            ))}
            <Link
              to="/templates/new"
              className="flex w-28 shrink-0 press-scale snap-start flex-col items-center justify-center gap-1.5 rounded-[var(--radius-card)] border-2 border-dashed border-separator text-subhead text-label-2"
            >
              <Plus className="size-6" />
              Новая
            </Link>
          </div>
        ) : (
          <Link
            to="/templates/new"
            className="flex press-scale items-center gap-3 rounded-[var(--radius-card)] bg-surface p-4"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
              <Plus className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-body font-semibold">Создать программу</span>
              <span className="block text-footnote text-label-2">
                Набор упражнений, чтобы начинать тренировку одним касанием
              </span>
            </span>
          </Link>
        )}
      </Section>

      {workouts && workouts.length > 0 && (
        <Section
          title="Последние"
          action={
            <Link to="/history" className="text-body text-accent">
              История
            </Link>
          }
        >
          {workouts.slice(0, 3).map((w) => (
            <WorkoutRow key={w.id} workout={w} />
          ))}
        </Section>
      )}

      {workouts?.length === 0 && !active && (
        <Section plain>
          <div className="rounded-[var(--radius-card)] bg-surface px-5 py-6 text-center">
            <div className="text-title-3 font-semibold">Первая тренировка</div>
            <p className="mt-1.5 text-subhead text-label-2">
              Нажми «Начать тренировку», добавь упражнения и отмечай подходы. Веса прошлого раза
              будут подсказками в пустых ячейках.
            </p>
          </div>
        </Section>
      )}

      <InstallHint />

      <StartSheet
        open={startOpen}
        onClose={() => {
          setStartOpen(false)
        }}
      />
      <ActionSheet
        open={templateMenu !== null}
        onClose={() => {
          setTemplateMenu(null)
        }}
        title={templateMenu?.name}
        message={
          templateMenu
            ? countLabel(templateMenu.exercises.length, 'упражнение', 'упражнения', 'упражнений')
            : undefined
        }
        actions={
          templateMenu
            ? [
                {
                  label: active ? 'Продолжить текущую тренировку' : 'Начать тренировку',
                  onSelect: () => {
                    if (active) workoutUi.open()
                    else void begin({ templateId: templateMenu.id })
                  },
                },
                {
                  label: 'Изменить программу',
                  onSelect: () => void navigate(`/templates/${templateMenu.id}`),
                },
              ]
            : []
        }
      />
    </Page>
  )
}

/** Цель недели: кольцо, дни недели и серия недель подряд. */
function WeekCard({ dates, goal, today }: { dates: string[]; goal: number; today: string }) {
  const days = weekDays(today)
  const monday = startOfWeek(today)
  const thisWeek = dates.filter((d) => d >= monday && d <= today)
  const trained = new Set(thisWeek)
  const count = thisWeek.length
  const streak = useMemo(() => streakWeeks(dates, goal, today), [dates, goal, today])
  const done = count >= goal
  return (
    <div className="flex items-center gap-5 rounded-[var(--radius-card)] bg-surface p-4 shadow-[var(--shadow-card)]">
      <Ring progress={count / goal} label={`${count} из ${goal} тренировок на этой неделе`}>
        <div className="text-center leading-none">
          <div className="font-rounded text-title-2 font-bold tabular">{count}</div>
          <div className="mt-0.5 text-caption-2 text-label-2">из {goal}</div>
        </div>
      </Ring>
      <div className="min-w-0 flex-1">
        <div className="text-body font-semibold">
          {done
            ? 'Цель недели выполнена'
            : `Ещё ${countLabel(goal - count, 'тренировка', 'тренировки', 'тренировок')}`}
        </div>
        <div className="mt-0.5 flex items-center gap-1 text-footnote text-label-2">
          {streak > 0 ? (
            <>
              <Flame className="size-3.5 text-warning" aria-hidden />
              {streak} {plural(streak, 'неделя', 'недели', 'недель')} подряд
            </>
          ) : (
            'Цель — ' + countLabel(goal, 'тренировка', 'тренировки', 'тренировок') + ' в неделю'
          )}
        </div>
        <div className="mt-3 grid grid-cols-7 gap-1">
          {days.map((d, i) => {
            const isToday = d === today
            const has = trained.has(d)
            return (
              <div key={d} className="flex flex-col items-center gap-1">
                <span
                  className={clsx(
                    'text-caption-2',
                    isToday ? 'font-bold text-label' : 'text-label-2',
                  )}
                >
                  {WEEKDAY_SHORT[i]}
                </span>
                <span
                  className={clsx(
                    'size-2.5 rounded-full',
                    has ? 'bg-accent' : d > today ? 'bg-fill-3' : 'bg-fill',
                    isToday && !has && 'shadow-[0_0_0_1.5px_var(--accent)]',
                  )}
                  aria-label={has ? `${WEEKDAY_SHORT[i]}: была тренировка` : undefined}
                />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/**
 * Главная кнопка, когда программы чередуются: следующая по кругу начинается одним
 * касанием. Пустая тренировка, другая программа, запись задним числом — справа.
 */
function NextCard({
  template,
  onStart,
  onOther,
}: {
  template: Template
  onStart: () => void
  onOther: () => void
}) {
  return (
    <div className="flex items-stretch gap-1 rounded-[var(--radius-card)] bg-accent p-1.5 text-on-accent">
      <button
        type="button"
        onClick={onStart}
        className="flex min-w-0 flex-1 press-scale items-center gap-3.5 rounded-[calc(var(--radius-card)-0.375rem)] p-2.5 text-left"
        aria-label={`Начать тренировку: ${template.name}`}
      >
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-white/20">
          <Play className="size-6 fill-current" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-body font-semibold">{template.name}</span>
          <span className="block truncate text-subhead opacity-85">
            Следующая ·{' '}
            {countLabel(template.exercises.length, 'упражнение', 'упражнения', 'упражнений')}
          </span>
        </span>
      </button>
      <button
        type="button"
        onClick={onOther}
        aria-label="Другая тренировка"
        title="Другая тренировка"
        className="flex w-12 shrink-0 press-scale items-center justify-center rounded-[calc(var(--radius-card)-0.375rem)] bg-white/15"
      >
        <Ellipsis className="size-5" strokeWidth={2.4} />
      </button>
    </div>
  )
}

function ActiveCard({ startedAt, title }: { startedAt: number; title: string | undefined }) {
  const now = useNow(1000)
  return (
    <button
      type="button"
      onClick={workoutUi.open}
      className="flex w-full press-scale items-center gap-4 rounded-[var(--radius-card)] bg-accent p-4 text-left text-on-accent"
    >
      <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-white/20">
        <Play className="size-6 fill-current" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-body font-semibold">{title ?? 'Тренировка'} идёт</span>
        <span className="block font-rounded text-subhead tabular opacity-85">
          {formatClock((now - startedAt) / 1000)} · продолжить
        </span>
      </span>
    </button>
  )
}

function TemplateCard({
  template,
  next,
  onClick,
}: {
  template: Template
  next: boolean
  onClick: () => void
}) {
  const exercises = useLiveQuery(
    () => db.exercises.bulkGet(template.exercises.map((e) => e.exerciseId)),
    [template],
  )
  const muscles = [...new Set((exercises ?? []).flatMap((e) => (e ? [e.muscle] : [])))]
  const names = (exercises ?? []).flatMap((e) => (e ? [e.name] : []))
  return (
    <button
      type="button"
      onClick={onClick}
      // Имя кнопки — с названия программы, а не с «2 недели назад».
      aria-label={[
        template.name,
        next ? 'следующая' : template.lastUsedAt ? formatAgo(dateOf(template.lastUsedAt)) : 'новая',
        names.join(', '),
      ]
        .filter(Boolean)
        .join('. ')}
      className="flex w-[13.5rem] shrink-0 press-scale snap-start flex-col rounded-[var(--radius-card)] bg-surface p-4 text-left shadow-[var(--shadow-card)]"
    >
      <span className="flex items-center justify-between gap-2">
        <MuscleDots muscles={muscles} />
        {next ? (
          <span className="rounded-full bg-accent-soft px-2 py-0.5 text-caption-2 font-semibold text-accent">
            следующая
          </span>
        ) : (
          <span className="text-caption text-label-2">
            {template.lastUsedAt ? formatAgo(dateOf(template.lastUsedAt)) : 'новая'}
          </span>
        )}
      </span>
      <span className="mt-2.5 line-clamp-1 text-body font-semibold">{template.name}</span>
      <span className="mt-0.5 line-clamp-2 text-footnote text-label-2">
        {names.length > 0 ? names.join(', ') : 'Пока без упражнений'}
      </span>
    </button>
  )
}

/** Однократная карточка: данные первой версии перенесены, ничего не потерялось. */
function MigrationCard() {
  const state = useMigrationState()
  const [closed, setClosed] = useState(false)
  if (closed || !state?.found || state.seen || !state.report) return null
  const r = state.report
  return (
    <Section plain>
      <div className="flex gap-3 rounded-[var(--radius-card)] bg-accent-soft p-4">
        <PartyPopper className="mt-0.5 size-6 shrink-0 text-accent" aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="text-body font-semibold">Новая версия дневника</div>
          <p className="mt-0.5 text-subhead text-label-2">
            Перенесено из прошлой версии:{' '}
            {countLabel(r.workouts, 'тренировка', 'тренировки', 'тренировок')},{' '}
            {countLabel(r.sets, 'подход', 'подхода', 'подходов')}
            {r.templates > 0
              ? `, ${countLabel(r.templates, 'программа', 'программы', 'программ')}`
              : ''}
            .
          </p>
          <button
            type="button"
            className="mt-2 text-subhead font-semibold text-accent"
            onClick={() => {
              setClosed(true)
              void markMigrationSeen()
            }}
          >
            Отлично
          </button>
        </div>
      </div>
    </Section>
  )
}

/** Напоминание о резервной копии, если давно не сохранял, а тренировки прибавились. */
function BackupBanner({ reminderDays }: { reminderDays: number }) {
  const due = useLiveQuery(async () => {
    const snoozed = await getMeta<number>('backupSnoozedUntil')
    if (snoozed && snoozed > Date.now()) return null
    const res = await backupDue(reminderDays)
    return res.due ? res : null
  }, [reminderDays])
  if (!due) return null

  async function save() {
    const file = await backupFile()
    const result = backupSavedMessage(await shareOrDownload(file))
    if (result) {
      if (result.saved) await markExported()
      toast(result.message)
    }
  }

  return (
    <Section plain>
      <div className="flex items-start gap-3 rounded-[var(--radius-card)] bg-surface p-4 shadow-[var(--shadow-card)]">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
          <ArrowDownToLine className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-body font-semibold">Сохрани резервную копию</div>
          <p className="mt-0.5 text-footnote text-label-2">
            {due.days !== null
              ? `Последняя — ${countLabel(due.days, 'день', 'дня', 'дней')} назад. `
              : ''}
            Тренировки хранятся только на этом телефоне.
          </p>
          <Button size="sm" variant="tinted" className="mt-2.5" onClick={() => void save()}>
            Сохранить в Файлы
          </Button>
        </div>
        <button
          type="button"
          aria-label="Напомнить позже"
          className="-mt-1 -mr-1 flex size-8 items-center justify-center rounded-full text-label-3"
          onClick={() => void setMeta('backupSnoozedUntil', Date.now() + 3 * 86_400_000)}
        >
          <X className="size-5" />
        </button>
      </div>
    </Section>
  )
}

/** Подсказка установить на экран «Домой», если открыто в обычном Safari. */
/**
 * Первую неделю нового месяца — приглашение посмотреть итоги прошлого.
 * Скрывается крестиком до следующего месяца.
 */
function MonthCard({ workouts, today }: { workouts: Workout[]; today: string }) {
  const previous = addMonths(startOfMonth(today), -1)
  const key = previous.slice(0, 7)
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem('td:month-card') === key
    } catch {
      return false
    }
  })
  const list = workouts.filter((w) => startOfMonth(w.date) === previous)
  const records = list.reduce((s, w) => s + (w.summary?.records ?? 0), 0)
  if (hidden || Number(today.slice(8, 10)) > 7 || list.length === 0) return null
  return (
    <Section plain>
      <div className="flex items-center gap-1 rounded-[var(--radius-card)] bg-surface shadow-[var(--shadow-card)]">
        <Link
          to={`/progress/month/${key}`}
          className="flex min-w-0 flex-1 press-scale items-center gap-3 p-4"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--warning)_18%,transparent)] text-warning">
            <PartyPopper className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-body font-semibold">Итоги {monthGenitive(previous)}</span>
            <span className="block truncate text-footnote text-label-2">
              {countLabel(list.length, 'тренировка', 'тренировки', 'тренировок')}
              {records > 0 && ` · ${countLabel(records, 'рекорд', 'рекорда', 'рекордов')}`}
            </span>
          </span>
          <ChevronRight
            className="size-[1.125rem] shrink-0 text-label-3"
            strokeWidth={2.5}
            aria-hidden
          />
        </Link>
        <button
          type="button"
          aria-label="Скрыть"
          className="mr-2 flex size-8 shrink-0 items-center justify-center text-label-3"
          onClick={() => {
            setHidden(true)
            try {
              localStorage.setItem('td:month-card', key)
            } catch {
              // Без хранилища карточка вернётся при следующем запуске — не беда.
            }
          }}
        >
          <X className="size-4" />
        </button>
      </div>
    </Section>
  )
}

function InstallHint() {
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem('td:install-hint') === 'hidden'
    } catch {
      return false
    }
  })
  const standalone =
    typeof window !== 'undefined' &&
    (matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true)
  if (standalone || hidden) return null
  return (
    <Section plain>
      <div className="flex items-start gap-3 rounded-[var(--radius-card)] bg-surface p-4">
        <Share className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden />
        <p className="min-w-0 flex-1 text-footnote text-label-2">
          Установи как приложение: в Safari нажми «Поделиться» → «На экран „Домой“». Так оно
          откроется на весь экран и будет работать без интернета.
        </p>
        <button
          type="button"
          aria-label="Скрыть"
          className="flex size-7 items-center justify-center text-label-3"
          onClick={() => {
            setHidden(true)
            try {
              localStorage.setItem('td:install-hint', 'hidden')
            } catch {
              // ничего
            }
          }}
        >
          <X className="size-4" />
        </button>
      </div>
    </Section>
  )
}
