import clsx from 'clsx'
import { Check, Database, ExternalLink, Info } from 'lucide-react'
import { useLastExportAt } from '@/db/hooks'
import { dateOf, formatAgo } from '@/domain/dates'
import { formatClock, formatNumber } from '@/domain/format'
import { haptic } from '@/lib/haptics'
import { ACCENTS, updateSettings, useSettings, type Accent } from '@/settings/settings'
import { Row, Section } from '@/ui/List'
import { Page } from '@/ui/Page'
import { Segmented } from '@/ui/Segmented'
import { Stepper } from '@/ui/Stepper'
import { Switch } from '@/ui/Switch'

/** Цвета образцов акцента — как в светлой теме, чтобы различались в обеих. */
const SWATCH: Record<Accent, string> = {
  indigo: '#5856d6',
  blue: '#007aff',
  teal: '#30b0c7',
  green: '#34c759',
  orange: '#ff9500',
  red: '#ff3b30',
  pink: '#ff2d55',
  purple: '#af52de',
}

const ACCENT_LABEL: Record<Accent, string> = {
  indigo: 'Индиго',
  blue: 'Синий',
  teal: 'Бирюзовый',
  green: 'Зелёный',
  orange: 'Оранжевый',
  red: 'Красный',
  pink: 'Розовый',
  purple: 'Фиолетовый',
}

export function SettingsPage() {
  const s = useSettings()
  const lastExport = useLastExportAt()

  return (
    <Page title="Настройки" back="/" tabbar>
      <Section header="Оформление">
        <div className="px-4 py-3">
          <Segmented
            label="Тема"
            value={s.theme}
            options={[
              { value: 'system', label: 'Авто' },
              { value: 'light', label: 'Светлая' },
              { value: 'dark', label: 'Тёмная' },
            ]}
            onChange={(theme) => {
              updateSettings({ theme })
            }}
          />
        </div>
        <div className="px-4 py-3 hairline-t">
          <div className="mb-2.5 text-body">Акцент</div>
          <div className="grid grid-cols-8 gap-2" role="radiogroup" aria-label="Цвет акцента">
            {ACCENTS.map((a) => (
              <button
                key={a}
                type="button"
                role="radio"
                aria-checked={s.accent === a}
                aria-label={ACCENT_LABEL[a]}
                onClick={() => {
                  haptic()
                  updateSettings({ accent: a })
                }}
                className={clsx(
                  'flex aspect-square w-full max-w-9 press-scale items-center justify-center justify-self-center rounded-full text-white',
                  s.accent === a &&
                    'ring-2 ring-[var(--label-3)] ring-offset-2 ring-offset-[var(--surface)]',
                )}
                style={{ background: SWATCH[a] }}
              >
                {s.accent === a && <Check className="size-5" strokeWidth={3} />}
              </button>
            ))}
          </div>
        </div>
      </Section>

      <Section
        header="Тренировки"
        footer="Отдых запускается, когда отмечаешь подход. Звук — короткий сигнал в конце; в беззвучном режиме iPhone его не будет."
      >
        <Row
          title="Цель в неделю"
          trailing={
            <Stepper
              value={s.weeklyGoal}
              min={1}
              max={7}
              label="Цель в неделю"
              onChange={(weeklyGoal) => {
                updateSettings({ weeklyGoal })
              }}
            />
          }
        />
        <div className="px-4 py-3 hairline-t">
          <div className="mb-2.5 text-body">Таймер отдыха</div>
          <Segmented
            label="Таймер отдыха"
            value={s.restTimer}
            options={[
              { value: 'off', label: 'Выключен' },
              { value: 'silent', label: 'Без звука' },
              { value: 'sound', label: 'Со звуком' },
            ]}
            onChange={(restTimer) => {
              updateSettings({ restTimer })
            }}
          />
        </div>
        <Row
          title="Отдых"
          subtitle="Между подходами"
          trailing={
            <Stepper
              value={s.restSec}
              min={15}
              max={600}
              step={15}
              label="Отдых"
              format={formatClock}
              onChange={(restSec) => {
                updateSettings({ restSec })
              }}
            />
          }
        />
        <Row
          title="Не гасить экран"
          subtitle="Пока идёт тренировка"
          trailing={
            <Switch
              label="Не гасить экран"
              checked={s.keepAwake}
              onChange={(keepAwake) => {
                updateSettings({ keepAwake })
              }}
            />
          }
        />
      </Section>

      <Section
        header="Веса"
        footer="Шаг — для кнопок «−» и «+» на клавиатуре. Гриф и блины — для подсказки раскладки на штангу."
      >
        <div className="px-4 py-3">
          <div className="mb-2.5 text-body">Шаг веса</div>
          <Segmented
            label="Шаг веса"
            value={String(s.weightStep)}
            options={[1, 1.25, 2.5, 5].map((v) => ({
              value: String(v),
              label: `${formatNumber(v)} кг`,
            }))}
            onChange={(v) => {
              updateSettings({ weightStep: Number(v) })
            }}
          />
        </div>
        <div className="px-4 py-3 hairline-t">
          <div className="mb-2.5 text-body">Гриф</div>
          <Segmented
            label="Вес грифа"
            value={String(s.barWeight)}
            options={[10, 15, 20].map((v) => ({ value: String(v), label: `${v} кг` }))}
            onChange={(v) => {
              updateSettings({ barWeight: Number(v) })
            }}
          />
        </div>
      </Section>

      <Section header="Данные">
        <Row
          icon={<Database />}
          iconBg="var(--success)"
          title="Резервные копии"
          subtitle={
            lastExport ? `Последняя: ${formatAgo(dateOf(lastExport))}` : 'Ещё не сохранялась'
          }
          chevron
          to="/settings/data"
        />
        <Row
          title="Напоминать о копии"
          trailing={
            <Stepper
              value={s.backupReminderDays}
              min={0}
              max={60}
              step={7}
              label="Напоминание"
              format={(v) => (v === 0 ? 'никогда' : `${v} дн.`)}
              onChange={(backupReminderDays) => {
                updateSettings({ backupReminderDays })
              }}
            />
          }
        />
      </Section>

      <Section header="О приложении">
        <Row
          icon={<Info />}
          iconBg="var(--m-other)"
          title="Версия"
          value={`${__APP_VERSION__} · ${__APP_COMMIT__}`}
        />
        <Row
          icon={<ExternalLink />}
          iconBg="#24292f"
          title="Исходный код на GitHub"
          onClick={() => {
            window.open('https://github.com/AntonioKapuchino/training-diary', '_blank', 'noopener')
          }}
        />
      </Section>
    </Page>
  )
}
