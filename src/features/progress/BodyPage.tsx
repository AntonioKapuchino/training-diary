import clsx from 'clsx'
import { Plus, Scale } from 'lucide-react'
import { useState } from 'react'
import { deleteBodyLog, restoreBodyLog, saveBodyLog, type BodyInput } from '@/db/body'
import { useBodyLogs } from '@/db/hooks'
import {
  BODY_METRIC,
  BODY_METRICS,
  formatBodyValue,
  inRange,
  measuredMetrics,
  monthChange,
  type BodyMetric,
} from '@/domain/body'
import {
  addDays,
  dateOf,
  formatDayMonth,
  formatDayMonthShort,
  formatRelativeDay,
  isISODate,
  parseISODate,
  todayISO,
} from '@/domain/dates'
import { formatNumber, parseDecimal } from '@/domain/format'
import type { BodyLog } from '@/domain/types'
import { useSessionState } from '@/lib/sessionState'
import { Button, IconButton } from '@/ui/Button'
import { LineChart } from '@/ui/charts/LineChart'
import { EmptyState } from '@/ui/EmptyState'
import { Section } from '@/ui/List'
import { Page } from '@/ui/Page'
import { Segmented } from '@/ui/Segmented'
import { Sheet } from '@/ui/Sheet'
import { SwipeRow } from '@/ui/SwipeRow'
import { toast } from '@/ui/Toast'

type Period = '3m' | '1y' | 'all'

/** Тело: вес, процент жира и обхваты — у каждого свой график. */
export function BodyPage() {
  const logs = useBodyLogs()
  const [editing, setEditing] = useState<BodyLog | 'new' | null>(null)
  const [period, setPeriod] = useSessionState<Period>('body.period', '3m')
  const [chosen, setChosen] = useSessionState<BodyMetric>('body.metric', 'weight')
  const measured = measuredMetrics(logs ?? [])
  const metric = measured.includes(chosen) ? chosen : (measured[0] ?? 'weight')

  async function remove(log: BodyLog) {
    await deleteBodyLog(log.id)
    toast('Замер удалён', { label: 'Вернуть', onAction: () => void restoreBodyLog(log) })
  }

  return (
    <Page
      title="Тело"
      back
      actions={
        <IconButton
          label="Добавить замер"
          onClick={() => {
            setEditing('new')
          }}
        >
          <Plus className="size-5" strokeWidth={2.4} />
        </IconButton>
      }
    >
      {logs === undefined ? null : logs.length === 0 ? (
        <EmptyState
          icon={<Scale />}
          title="Нет замеров"
          message="Вес — утром натощак раз в несколько дней. Обхваты и процент жира — раз в месяц: так тренд будет честным."
          action={
            <Button
              onClick={() => {
                setEditing('new')
              }}
            >
              Добавить замер
            </Button>
          }
        />
      ) : (
        <>
          {measured.length > 1 && (
            <div
              className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-1"
              role="group"
              aria-label="Показатель"
            >
              {measured.map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={m === metric}
                  onClick={() => {
                    setChosen(m)
                  }}
                  className={clsx(
                    'inline-flex h-8 shrink-0 press-scale items-center rounded-full px-3.5 text-subhead font-medium transition-colors',
                    m === metric
                      ? 'bg-label text-surface'
                      : 'bg-surface text-label shadow-[var(--shadow-card)] dark:bg-fill-3',
                  )}
                >
                  {BODY_METRIC[m].label}
                </button>
              ))}
            </div>
          )}
          <MetricCard logs={logs} metric={metric} period={period} onPeriod={setPeriod} />

          <Section header="Замеры">
            {[...logs].reverse().map((l) => (
              <SwipeRow key={l.id} onDelete={() => void remove(l)}>
                <LogRow
                  log={l}
                  metric={metric}
                  onClick={() => {
                    setEditing(l)
                  }}
                />
              </SwipeRow>
            ))}
          </Section>
        </>
      )}

      <Sheet
        open={editing !== null}
        onClose={() => {
          setEditing(null)
        }}
        title={editing === 'new' ? 'Новый замер' : 'Замер'}
      >
        {editing !== null && (
          <BodyForm
            log={editing === 'new' ? undefined : editing}
            onClose={() => {
              setEditing(null)
            }}
          />
        )}
      </Sheet>
    </Page>
  )
}

/** Выбранный показатель: последнее значение, изменение за месяц, график за период. */
function MetricCard({
  logs,
  metric,
  period,
  onPeriod,
}: {
  logs: BodyLog[]
  metric: BodyMetric
  period: Period
  onPeriod: (p: Period) => void
}) {
  const def = BODY_METRIC[metric]
  const withValue = logs.filter((l) => l[metric] !== undefined)
  const since = period === 'all' ? '' : addDays(todayISO(), period === '3m' ? -92 : -366)
  const series = withValue
    .filter((l) => l.date >= since)
    .map((l) => ({ x: parseISODate(l.date).getTime() + 12 * 3_600_000, y: l[metric] ?? 0 }))
  const last = withValue.at(-1)
  const value = last?.[metric]
  const change = monthChange(logs, metric, addDays(todayISO(), -28))

  return (
    <Section plain className="mt-3">
      <div className="rounded-[var(--radius-card)] bg-surface p-4 shadow-[var(--shadow-card)]">
        <div className="mb-1 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-footnote text-label-2">{def.label}</div>
            <div className="font-rounded text-title-1 font-bold tabular">
              {value !== undefined ? formatBodyValue(metric, value) : '—'}
            </div>
            {last && (
              <div className="text-footnote text-label-2">{formatRelativeDay(last.date)}</div>
            )}
          </div>
          {change !== null && Math.abs(change) >= 0.05 && (
            <span className="mt-1 shrink-0 rounded-full bg-fill-3 px-2.5 py-1 text-footnote font-semibold tabular">
              {change > 0 ? '+' : '−'}
              {formatNumber(Math.abs(change), 1)} {def.unit} за месяц
            </span>
          )}
        </div>
        {series.length >= 2 ? (
          <LineChart
            points={series}
            color="var(--accent)"
            formatY={(v) => formatNumber(v, 1)}
            formatX={(x) => formatDayMonth(dateOf(x))}
            axisX={(x) => formatDayMonthShort(dateOf(x))}
            label={`${def.label}: от ${formatBodyValue(metric, series[0]?.y ?? 0)} до ${formatBodyValue(metric, series.at(-1)?.y ?? 0)}`}
          />
        ) : (
          <p className="py-10 text-center text-subhead text-label-2">
            {withValue.length < 2
              ? 'График появится после второго замера'
              : 'За этот период мало замеров'}
          </p>
        )}
        <Segmented
          className="mt-3"
          label="Период"
          value={period}
          options={[
            { value: '3m', label: '3 мес' },
            { value: '1y', label: 'Год' },
            { value: 'all', label: 'Всё' },
          ]}
          onChange={onPeriod}
        />
      </div>
    </Section>
  )
}

/** Строка замера: справа — выбранный показатель, под датой — остальное и заметка. */
function LogRow({
  log,
  metric,
  onClick,
}: {
  log: BodyLog
  metric: BodyMetric
  onClick: () => void
}) {
  const main =
    log[metric] !== undefined ? metric : BODY_METRICS.find((m) => log[m.key] !== undefined)?.key
  const rest = BODY_METRICS.filter((m) => m.key !== main && log[m.key] !== undefined).map(
    (m) => `${m.short} ${formatBodyValue(m.key, log[m.key] ?? 0)}`,
  )
  const details = [...rest, ...(log.note ? [log.note] : [])].join(' · ')
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 pressable px-4 py-3 text-left"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-body">{formatDayMonth(log.date)}</span>
        {details && <span className="block truncate text-footnote text-label-2">{details}</span>}
      </span>
      {/* Выбранного показателя в этом замере нет — справа другой, серым. */}
      <span
        className={clsx(
          'shrink-0 font-rounded text-body font-semibold tabular',
          main !== metric && 'text-label-2',
        )}
      >
        {main ? formatBodyValue(main, log[main] ?? 0) : '—'}
      </span>
    </button>
  )
}

function BodyForm({ log, onClose }: { log: BodyLog | undefined; onClose: () => void }) {
  const [date, setDate] = useState(log?.date ?? todayISO())
  const [values, setValues] = useState<Record<BodyMetric, string>>(
    () =>
      Object.fromEntries(
        BODY_METRICS.map((m) => [
          m.key,
          log?.[m.key] !== undefined ? formatNumber(log[m.key] ?? 0) : '',
        ]),
      ) as Record<BodyMetric, string>,
  )
  const [note, setNote] = useState(log?.note ?? '')

  const parsed = BODY_METRICS.map((m) => ({
    def: m,
    raw: values[m.key],
    value: parseDecimal(values[m.key]),
  }))
  const typo = parsed.find(
    (p) => p.raw.trim() !== '' && (p.value === undefined || !inRange(p.def.key, p.value)),
  )
  const filled = parsed.filter((p) => p.value !== undefined && inRange(p.def.key, p.value))
  const valid = isISODate(date) && date <= todayISO() && filled.length > 0 && !typo

  async function save() {
    if (!valid) return
    const input: BodyInput = { ...(log ? { id: log.id } : {}), date, note }
    // Каждый показатель — явно, даже пустой: стёртое значение должно удалиться.
    for (const p of parsed)
      input[p.def.key] = p.value !== undefined && inRange(p.def.key, p.value) ? p.value : undefined
    await saveBodyLog(input)
    onClose()
  }

  const field =
    'min-w-0 flex-1 bg-transparent py-3 text-right text-body outline-none placeholder:text-label-3'
  return (
    <form
      className="space-y-3 px-4 pb-5"
      onSubmit={(e) => {
        e.preventDefault()
        void save()
      }}
    >
      <div className="overflow-hidden rounded-[var(--radius-card)] bg-fill-3">
        {BODY_METRICS.map((m, i) => (
          <label
            key={m.key}
            className={clsx('flex min-h-12 items-center gap-3 px-4', i > 0 && 'hairline-t')}
          >
            <span className="w-28 text-body">
              {m.label}
              {m.unit !== '%' && <span className="text-label-2">, {m.unit}</span>}
            </span>
            <input
              autoFocus={!log && i === 0}
              inputMode="decimal"
              enterKeyHint="next"
              value={values[m.key]}
              onChange={(e) => {
                setValues({ ...values, [m.key]: e.target.value })
              }}
              placeholder={i === 0 ? m.placeholder : 'необязательно'}
              aria-label={`${m.label}${m.unit === '%' ? '' : `, ${m.unit}`}`}
              className={clsx(field, 'font-rounded', i === 0 && 'font-semibold')}
            />
          </label>
        ))}
      </div>
      <div className="overflow-hidden rounded-[var(--radius-card)] bg-fill-3">
        <label className="flex min-h-12 items-center gap-3 px-4">
          <span className="w-28 text-body">Дата</span>
          <input
            type="date"
            value={date}
            max={todayISO()}
            onChange={(e) => {
              setDate(e.target.value)
            }}
            className={`${field} text-accent`}
          />
        </label>
        <label className="flex min-h-12 items-center gap-3 px-4 hairline-t">
          <span className="w-28 text-body">Заметка</span>
          <input
            value={note}
            onChange={(e) => {
              setNote(e.target.value)
            }}
            placeholder="утром, натощак"
            className={field}
          />
        </label>
      </div>
      {typo && (
        <p className="px-4 text-footnote text-danger">
          {typo.def.label}: похоже на опечатку — бывает от {formatNumber(typo.def.min)} до{' '}
          {formatNumber(typo.def.max)} {typo.def.unit}.
        </p>
      )}
      <Button type="submit" block size="lg" disabled={!valid}>
        Сохранить
      </Button>
    </form>
  )
}
