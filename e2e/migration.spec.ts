import { expect, test } from '@playwright/test'
import { countRows, fixToday, seedLegacyDatabase } from './helpers'

test('данные первой версии переносятся при первом запуске', async ({ page }) => {
  await fixToday(page)
  await seedLegacyDatabase(page)
  await page.goto('/')

  await expect(page.getByText('Новая версия дневника')).toBeVisible()
  await expect(page.getByText(/Перенесено из прошлой версии: 6 тренировок/)).toBeVisible()
  expect(await countRows(page, 'workouts')).toBe(6)

  // Повторный запуск не дублирует данные.
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Сегодня', level: 1 })).toBeVisible()
  expect(await countRows(page, 'workouts')).toBe(6)

  // История и программа на месте.
  await page
    .getByRole('navigation', { name: 'Разделы' })
    .getByRole('link', { name: 'История' })
    .click()
  await expect(page.getByText('6 тренировок')).toBeVisible()
  await page
    .getByRole('navigation', { name: 'Разделы' })
    .getByRole('link', { name: 'Сегодня' })
    .click()
  await expect(page.getByText('День A — верх').first()).toBeVisible()

  // Карточка о переносе закрывается навсегда.
  await page.getByRole('button', { name: 'Отлично' }).click()
  await expect(page.getByText('Новая версия дневника')).toBeHidden()
  await page.waitForTimeout(300)
  await page.reload()
  await expect(page.getByText('Новая версия дневника')).toBeHidden()
})
