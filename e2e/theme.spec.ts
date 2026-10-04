import { expect, test } from '@playwright/test'
import { fixToday } from './helpers'

/** Относительная яркость по WCAG для «rgb(r, g, b)». */
function luminance(rgb: string): number {
  const [r = 0, g = 0, b = 0] = (rgb.match(/[\d.]+/g) ?? []).map(Number).map((c) => {
    const v = c / 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05)
}

test.use({ colorScheme: 'dark' })

// Первая версия рисовала цифры подходов чёрным по тёмному — проверяем контраст.
test('в тёмной теме цифры подходов читаются', async ({ page }) => {
  await fixToday(page)
  await page.goto('/')
  await page.getByRole('button', { name: 'Начать тренировку' }).click()
  await page.getByRole('button', { name: /Пустая тренировка/ }).click()
  const workout = page.getByRole('dialog', { name: /^Тренировка/ })
  await workout.getByRole('button', { name: 'Добавить упражнение' }).click()
  const picker = page.getByRole('dialog', { name: 'Добавить упражнения' })
  await picker.getByRole('searchbox').fill('присед')
  await picker.getByRole('button', { name: /^Приседания со штангой/ }).click()
  await picker.getByRole('button', { name: 'Добавить 1' }).click()

  const cell = workout.getByRole('button', { name: /^Вес/ }).first()
  await cell.click()
  await page.keyboard.type('100')
  await page.keyboard.press('Escape')

  const colors = await workout.getByRole('button', { name: 'Вес: 100' }).evaluate((el) => {
    const text = getComputedStyle(el.querySelector('span') ?? el).color
    // Фон ячейки полупрозрачный — берём фон карточки под ней.
    const card = el.closest('article')
    return { text, bg: getComputedStyle(card ?? document.body).backgroundColor }
  })
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('dark')
  expect(contrast(colors.text, colors.bg)).toBeGreaterThan(7)
})
