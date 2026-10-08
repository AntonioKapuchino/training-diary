import { expect, test } from '@playwright/test'
import { fixToday, seedLegacyDatabase } from './helpers'

test('разминка одним касанием: ступени до рабочего веса и отмена', async ({ page }) => {
  await fixToday(page)
  await page.goto('/')
  await page.getByRole('button', { name: 'Начать тренировку' }).click()
  await page.getByRole('button', { name: /Пустая тренировка/ }).click()
  const workout = page.getByRole('dialog', { name: /^Тренировка/ })
  await workout.getByRole('button', { name: 'Добавить упражнение' }).click()
  const picker = page.getByRole('dialog', { name: 'Добавить упражнения' })
  await picker.getByRole('searchbox').fill('жим лёжа')
  await picker.getByRole('button', { name: /^Жим лёжа Штанга/ }).click()
  await picker.getByRole('button', { name: 'Добавить 1' }).click()

  const card = workout.getByRole('article', { name: 'Жим лёжа' })
  await card.getByRole('button', { name: /^Вес/ }).first().click()
  await page.keyboard.type('80')
  await page.keyboard.press('Enter')
  await page.keyboard.type('5')
  await page.keyboard.press('Enter')
  await page
    .getByRole('button', { name: 'Скрыть клавиатуру' })
    .click({ timeout: 2000 })
    .catch(() => undefined)

  await card.getByRole('button', { name: 'Разминка', exact: true }).click()
  await expect(page.getByText('Разминка: 4 подхода')).toBeVisible()
  // Гриф × 10, затем 40, 60, 80 % под блины — перед рабочим подходом.
  for (const w of ['20', '32,5', '47,5', '65']) {
    await expect(card.getByRole('button', { name: `Вес: ${w}` })).toBeVisible()
  }
  await expect(card.getByRole('button', { name: 'Разминка', exact: true })).toHaveCount(0)

  await page.getByRole('status').getByRole('button', { name: 'Отменить' }).click()
  await expect(card.getByRole('button', { name: 'Вес: 32,5' })).toHaveCount(0)
  await expect(card.getByRole('button', { name: 'Разминка', exact: true })).toBeVisible()
})

test('замеры тела: все показатели и у каждого свой график', async ({ page }) => {
  await fixToday(page)
  await page.goto('/#/progress/body')
  await page.getByRole('button', { name: 'Добавить замер' }).first().click()
  const form = page.getByRole('dialog', { name: 'Новый замер' })
  await form.getByRole('textbox', { name: 'Вес, кг' }).fill('80,4')
  await form.getByRole('textbox', { name: 'Талия, см' }).fill('85')
  await form.getByRole('textbox', { name: 'Руки, см' }).fill('38,5')
  await form.getByRole('button', { name: 'Сохранить' }).click()

  await expect(page.getByText('талия 85 см · руки 38,5 см')).toBeVisible()
  await page.getByRole('button', { name: 'Талия', exact: true }).click()
  await expect(page.getByText('85 см').first()).toBeVisible()

  // Опечатка не сохраняется.
  await page.getByRole('button', { name: 'Добавить замер' }).first().click()
  await page
    .getByRole('dialog', { name: 'Новый замер' })
    .getByRole('textbox', { name: 'Вес, кг' })
    .fill('815')
  await expect(page.getByText(/похоже на опечатку/)).toBeVisible()
  await expect(
    page.getByRole('dialog', { name: 'Новый замер' }).getByRole('button', { name: 'Сохранить' }),
  ).toBeDisabled()
})

test('итоги месяца: цифры, рекорды и картинка', async ({ page }) => {
  await fixToday(page)
  await seedLegacyDatabase(page)
  await page.addInitScript(() => {
    // Меню «Поделиться» в тесте не открыть — картинка скачивается файлом.
    Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true })
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'Отлично' }).click()
  await page.getByRole('link', { name: 'Прогресс' }).click()
  await page.getByRole('link', { name: /^Сентябрь/ }).click()

  await expect(page.getByRole('heading', { name: 'Сентябрь', level: 1 })).toBeVisible()
  await expect(page.getByText('тренировок', { exact: true })).toBeVisible()
  await expect(page.getByText('Главные упражнения')).toBeVisible()

  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Поделиться картинкой' }).click()
  expect((await download).suggestedFilename()).toBe('итоги-2026-09.png')
})

test('проценты от максимума в карточке упражнения', async ({ page }) => {
  await fixToday(page)
  await seedLegacyDatabase(page)
  await page.goto('/')
  await page.getByRole('button', { name: 'Отлично' }).click()
  await page.goto('/#/exercises/c%3Abench-press')
  await expect(page.getByText(/^Проценты от максимума/)).toBeVisible()
  await expect(page.getByText('90 %')).toBeVisible()
})
