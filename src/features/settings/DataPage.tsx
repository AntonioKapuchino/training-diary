import { useLiveQuery } from 'dexie-react-hooks'
import { FileSpreadsheet, FileUp, History, Save, ShieldAlert, ShieldCheck } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import {
  applyImport,
  backupFile,
  csvFile,
  ImportError,
  markExported,
  previewImport,
  restoreSnapshot,
  type ImportPreview,
} from '@/db/backup'
import { db, type Snapshot } from '@/db/db'
import { useLastExportAt, useMigrationState } from '@/db/hooks'
import { dateOf, formatAgo, formatDayMonth, formatTime } from '@/domain/dates'
import { countLabel, formatNumber } from '@/domain/format'
import { shareOrDownload } from '@/lib/share'
import { isPersisted, requestPersistence, storageUsage } from '@/lib/storage'
import { ActionSheet } from '@/ui/ActionSheet'
import { Button } from '@/ui/Button'
import { Row, Section } from '@/ui/List'
import { Page } from '@/ui/Page'
import { Sheet } from '@/ui/Sheet'
import { toast } from '@/ui/Toast'

const REASON: Record<Snapshot['reason'], string> = {
  auto: 'еженедельный',
  'before-import': 'перед загрузкой файла',
  'before-restore': 'перед восстановлением',
  'before-migration': 'перед переносом',
}

export function DataPage() {
  const lastExport = useLastExportAt()
  const migration = useMigrationState()
  const snapshots = useLiveQuery(() => db.snapshots.orderBy('createdAt').reverse().toArray(), [])
  const [persisted, setPersisted] = useState<boolean | null>(null)
  const [usage, setUsage] = useState<number | null>(null)
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [restoreFrom, setRestoreFrom] = useState<Snapshot | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const counts = useLiveQuery(async () => ({
    workouts: await db.workouts.where('status').equals('done').count(),
    templates: await db.templates.count(),
  }))

  useEffect(() => {
    void isPersisted().then(setPersisted)
    void storageUsage().then(setUsage)
  }, [])

  async function exportJson() {
    const file = await backupFile()
    const res = await shareOrDownload(file)
    if (res !== 'cancelled') {
      await markExported()
      toast('Резервная копия сохранена')
    }
  }

  async function exportCsv() {
    await shareOrDownload(await csvFile())
  }

  async function onFile(file: File | undefined) {
    if (!file) return
    try {
      setPreview(previewImport(await file.text()))
    } catch (e) {
      toast(e instanceof ImportError ? e.message : 'Не удалось прочитать файл')
    }
  }

  async function confirmImport() {
    if (!preview) return
    await applyImport(preview)
    setPreview(null)
    toast(`Загружено: ${countLabel(preview.workouts, 'тренировка', 'тренировки', 'тренировок')}`)
  }

  return (
    <Page title="Резервные копии" back="/settings" inline>
      <Section
        header="Хранилище"
        footer={
          persisted
            ? 'Браузер не удалит данные дневника, даже если на iPhone кончится место.'
            : 'Данные хранятся только на этом устройстве. Сохраняй резервную копию в Файлы или iCloud время от времени.'
        }
      >
        <Row
          icon={persisted ? <ShieldCheck /> : <ShieldAlert />}
          iconBg={persisted ? 'var(--success)' : 'var(--warning)'}
          title={persisted ? 'Данные защищены' : 'Защита не включена'}
          subtitle={[
            counts ? countLabel(counts.workouts, 'тренировка', 'тренировки', 'тренировок') : null,
            usage !== null ? `${formatNumber(usage / 1024 / 1024, 1)} МБ` : null,
          ]
            .filter(Boolean)
            .join(' · ')}
          trailing={
            persisted === false ? (
              <Button
                size="sm"
                variant="tinted"
                onClick={() =>
                  void requestPersistence().then((ok) => {
                    setPersisted(ok)
                    if (!ok)
                      toast(
                        'Браузер решает сам — для приложения с экрана «Домой» защита обычно включается',
                      )
                  })
                }
              >
                Включить
              </Button>
            ) : undefined
          }
        />
      </Section>

      <Section
        header="Сохранить"
        footer={
          lastExport
            ? `Последняя копия — ${formatAgo(dateOf(lastExport))}, ${formatTime(lastExport)}.`
            : 'Копия ещё не сохранялась.'
        }
      >
        <Row
          icon={<Save />}
          title="Копия в Файлы"
          subtitle="Всё: тренировки, программы, настройки"
          onClick={() => void exportJson()}
        />
        <Row
          icon={<FileSpreadsheet />}
          iconBg="var(--success)"
          title="Таблица для Excel"
          subtitle="Подход на строку, формат CSV"
          onClick={() => void exportCsv()}
        />
      </Section>

      <Section
        header="Восстановить"
        footer="Подходят копии этой и первой версии дневника. Перед заменой текущие данные сохраняются в снимок ниже."
      >
        <Row
          icon={<FileUp />}
          iconBg="var(--warning)"
          title="Загрузить из файла"
          onClick={() => fileInput.current?.click()}
        />
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            e.target.value = ''
            void onFile(f)
          }}
        />
      </Section>

      {snapshots && snapshots.length > 0 && (
        <Section
          header="Снимки на устройстве"
          footer="Делаются сами раз в неделю и перед заменой данных. Спасают от собственной ошибки, но не от потери телефона."
        >
          {snapshots.map((snap) => (
            <Row
              key={snap.id}
              icon={<History />}
              iconBg="var(--m-other)"
              title={`${formatDayMonth(dateOf(snap.createdAt))}, ${formatTime(snap.createdAt)}`}
              subtitle={`${REASON[snap.reason]} · ${countLabel(snap.workouts, 'тренировка', 'тренировки', 'тренировок')}`}
              onClick={() => {
                setRestoreFrom(snap)
              }}
            />
          ))}
        </Section>
      )}

      {migration?.found && migration.report && (
        <Section
          header="Первая версия"
          footer="Старая база не удалялась и остаётся на телефоне как запасная копия."
        >
          <Row
            title="Данные перенесены"
            subtitle={`${countLabel(migration.report.workouts, 'тренировка', 'тренировки', 'тренировок')}, ${countLabel(migration.report.templates, 'программа', 'программы', 'программ')} · ${formatDayMonth(dateOf(migration.at))}`}
          />
        </Section>
      )}

      <ImportSheet
        preview={preview}
        onClose={() => {
          setPreview(null)
        }}
        onConfirm={() => void confirmImport()}
      />
      <ActionSheet
        open={restoreFrom !== null}
        onClose={() => {
          setRestoreFrom(null)
        }}
        title="Вернуть данные из снимка?"
        message="Текущие данные заменятся снимком. Перед этим они тоже сохранятся в снимок."
        actions={[
          {
            label: 'Восстановить',
            destructive: true,
            onSelect: () => {
              if (restoreFrom)
                void restoreSnapshot(restoreFrom.id).then(() => toast('Данные восстановлены'))
            },
          },
        ]}
      />
    </Page>
  )
}

function ImportSheet({
  preview,
  onClose,
  onConfirm,
}: {
  preview: ImportPreview | null
  onClose: () => void
  onConfirm: () => void
}) {
  return (
    <Sheet open={preview !== null} onClose={onClose} title="Загрузить копию?">
      {preview && (
        <div className="space-y-4 px-4 pb-5">
          <div className="rounded-[var(--radius-card)] bg-fill-3 p-4 text-subhead">
            <div className="font-semibold">
              {preview.source === 'legacy' ? 'Копия первой версии дневника' : 'Резервная копия'}
              {preview.exportedAt && ` от ${formatDayMonth(preview.exportedAt.slice(0, 10))}`}
            </div>
            <ul className="mt-2 space-y-1 text-label-2">
              <li>
                {countLabel(preview.workouts, 'тренировка', 'тренировки', 'тренировок')}
                {preview.firstDate &&
                  preview.lastDate &&
                  ` (${formatDayMonth(preview.firstDate)} — ${formatDayMonth(preview.lastDate)})`}
              </li>
              <li>{countLabel(preview.templates, 'программа', 'программы', 'программ')}</li>
              {preview.customExercises > 0 && (
                <li>
                  {countLabel(
                    preview.customExercises,
                    'своё упражнение',
                    'своих упражнения',
                    'своих упражнений',
                  )}
                </li>
              )}
              {preview.bodyLogs > 0 && (
                <li>{countLabel(preview.bodyLogs, 'замер', 'замера', 'замеров')} веса</li>
              )}
              {preview.dropped > 0 && (
                <li className="text-warning">Пропущено битых записей: {preview.dropped}</li>
              )}
            </ul>
          </div>
          <p className="px-1 text-footnote text-label-2">
            Все текущие данные заменятся содержимым файла. Перед этим они сохранятся в снимок — их
            можно будет вернуть.
          </p>
          <Button block size="lg" variant="destructive" onClick={onConfirm}>
            Заменить данные
          </Button>
          <Button block size="lg" variant="gray" onClick={onClose}>
            Отмена
          </Button>
        </div>
      )}
    </Sheet>
  )
}
