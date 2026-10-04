import { Plus, Scale } from 'lucide-react'
import { useState } from 'react'
import { deleteBodyLog, restoreBodyLog, saveBodyLog } from '@/db/body'
import { useBodyLogs } from '@/db/hooks'
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
import { formatNumber, formatWeight, parseDecimal } from '@/domain/format'
import type { BodyLog } from '@/domain/types'
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

export function BodyPage() {
  const logs = useBodyLogs()
  const [editing, setEditing] = useState<BodyLog | 'new' | null>(null)
  const [period, setPeriod] = useState<Period>('3m')
  const weights = (logs ?? []).filter((l) => l.weight !== undefined)
  const since = period === 'all' ? '' : addDays(todayISO(), period === '3m' ? -92 : -366)
  const series = weights
    .filter((l) => l.date >= since)
    .map((l) => ({ x: parseISODate(l.date).getTime() + 12 * 3_600_000, y: l.weight ?? 0 }))
  const last = weights.at(-1)
  const monthAgo = weights.filter((l) => l.date <= addDays(todayISO(), -28)).at(-1)

  async function remove(log: BodyLog) {
    await deleteBodyLog(log.id)
    toast('Запись удалена', { label: 'Вернуть', onAction: () => void restoreBodyLog(log) })
  }

  return (
    <Page
      title="Вес тела"
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
      {logs?.length === 0 ? (
        <EmptyState
          icon={<Scale />}
          title="Нет замеров"
          message="Взвешивайся утром натощак раз в несколько дней — так тренд будет честным."
          action={
            <Button
              onClick={() => {
                setEditing('new')
              }}
            >
              Добавить вес
            </Button>
          }
        />
      ) : (
        <>
          {last?.weight !== undefined && (
            <div className="px-5">
              <div className="font-rounded text-large-title font-bold">
                {formatWeight(last.weight)}
              </div>
              <div className="text-subhead text-label-2">
                {formatRelativeDay(last.date)}
                {monthAgo?.weight !== undefined && (
                  <>
                    {' '}
                    · {last.weight - monthAgo.weight >= 0 ? '+' : '−'}
                    {formatNumber(Math.abs(last.weight - monthAgo.weight), 1)} кг за месяц
                  </>
                )}
              </div>
            </div>
          )}
          <Section plain className="mt-4">
            <div className="rounded-[var(--radius-card)] bg-surface p-4 shadow-[var(--shadow-card)]">
              {series.length >= 2 ? (
                <LineChart
                  points={series}
                  color="var(--accent)"
                  formatY={(v) => formatNumber(v, 1)}
                  formatX={(x) => formatDayMonth(dateOf(x))}
                  axisX={(x) => formatDayMonthShort(dateOf(x))}
                  label="Вес тела"
                />
              ) : (
                <p className="py-10 text-center text-subhead text-label-2">
                  График появится после второго замера
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
                onChange={setPeriod}
              />
            </div>
          </Section>

          <Section header="Замеры">
            {[...(logs ?? [])].reverse().map((l) => (
              <SwipeRow key={l.id} onDelete={() => void remove(l)}>
                <button
                  type="button"
                  onClick={() => {
                    setEditing(l)
                  }}
                  className="flex w-full items-center gap-3 pressable px-4 py-3 text-left"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-body">{formatDayMonth(l.date)}</span>
                    {(l.waist ?? l.note) !== undefined && (
                      <span className="block truncate text-footnote text-label-2">
                        {[
                          l.waist !== undefined ? `талия ${formatNumber(l.waist)} см` : null,
                          l.note,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    )}
                  </span>
                  <span className="font-rounded text-body font-semibold tabular">
                    {l.weight !== undefined ? formatWeight(l.weight) : '—'}
                  </span>
                </button>
              </SwipeRow>
            ))}
          </Section>
        </>
      )}

      <BodyLogSheet
        log={editing}
        onClose={() => {
          setEditing(null)
        }}
      />
    </Page>
  )
}

function BodyLogSheet({ log, onClose }: { log: BodyLog | 'new' | null; onClose: () => void }) {
  return (
    <Sheet open={log !== null} onClose={onClose} title={log === 'new' ? 'Новый замер' : 'Замер'}>
      {log !== null && <BodyForm log={log === 'new' ? undefined : log} onClose={onClose} />}
    </Sheet>
  )
}

function BodyForm({ log, onClose }: { log: BodyLog | undefined; onClose: () => void }) {
  const [date, setDate] = useState(log?.date ?? todayISO())
  const [weight, setWeight] = useState(log?.weight !== undefined ? formatNumber(log.weight) : '')
  const [waist, setWaist] = useState(log?.waist !== undefined ? formatNumber(log.waist) : '')
  const [note, setNote] = useState(log?.note ?? '')
  const w = parseDecimal(weight)
  const valid = isISODate(date) && w !== undefined && w > 20 && w < 400

  async function save() {
    if (!valid) return
    const waistValue = parseDecimal(waist)
    await saveBodyLog({
      ...(log ? { id: log.id } : {}),
      date,
      weight: w,
      ...(waistValue !== undefined ? { waist: waistValue } : {}),
      note,
    })
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
        <label className="flex min-h-12 items-center gap-3 px-4">
          <span className="w-24 text-body">Вес, кг</span>
          <input
            autoFocus={!log}
            inputMode="decimal"
            value={weight}
            onChange={(e) => {
              setWeight(e.target.value)
            }}
            placeholder="78,5"
            className={`${field} font-rounded font-semibold`}
          />
        </label>
        <label className="flex min-h-12 items-center gap-3 px-4 hairline-t">
          <span className="w-24 text-body">Талия, см</span>
          <input
            inputMode="decimal"
            value={waist}
            onChange={(e) => {
              setWaist(e.target.value)
            }}
            placeholder="необязательно"
            className={field}
          />
        </label>
        <label className="flex min-h-12 items-center gap-3 px-4 hairline-t">
          <span className="w-24 text-body">Дата</span>
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
          <span className="w-24 text-body">Заметка</span>
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
      <Button type="submit" block size="lg" disabled={!valid}>
        Сохранить
      </Button>
    </form>
  )
}
