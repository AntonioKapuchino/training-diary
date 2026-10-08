import { expect, test } from '@playwright/test'
import { countRows, fixToday, seedLegacyDatabase } from './helpers'

test('тренировка от начала до итогов', async ({ page }) => {
  await fixToday(page)
  await page.goto('/')
  await page.getByRole('button', { name: 'Начать тренировку' }).click()
  await page.getByRole('button', { name: /Пустая тренировка/ }).click()

  const workout = page.getByRole('dialog', { name: /^Тренировка/ })
  await expect(workout).toBeVisible()

  // Добавить упражнение через поиск — «лежа» без «ё» тоже находится.
  await workout.getByRole('button', { name: 'Добавить упражнение' }).click()
  const picker = page.getByRole('dialog', { name: 'Добавить упражнения' })
  await picker.getByRole('searchbox').fill('жим лежа')
  await picker.getByRole('button', { name: /^Жим лёжа Штанга/ }).click()
  await picker.getByRole('button', { name: 'Добавить 1' }).click()

  const card = workout.getByRole('article', { name: 'Жим лёжа' })
  await expect(card).toBeVisible()

  // Вес и повторы — своей клавиатурой; «Готово» на последнем поле засчитывает подход.
  await card.getByRole('button', { name: /^Вес/ }).first().click()
  const keypad = page.getByRole('group', { name: /Ввод: Вес/ })
  await expect(keypad).toBeVisible()
  for (const key of ['6', '2', 'Запятая', '5']) {
    if (key === 'Запятая') await keypad.getByRole('button', { name: 'Запятая' }).click()
    else await keypad.getByRole('button', { name: key, exact: true }).click()
  }
  await keypad.getByRole('button', { name: 'Далее' }).click()
  await page.keyboard.type('8')
  await page.getByRole('button', { name: 'Готово' }).last().click()

  await expect(card.getByRole('button', { name: 'Снять отметку' })).toHaveCount(1)
  await expect(card.getByRole('button', { name: 'Вес: 62,5' })).toBeVisible()
  // Отдых запустился сам.
  await expect(page.getByRole('timer')).toBeVisible()

  // Второй подход — отметкой: значения берутся из подхода выше.
  await page
    .getByRole('button', { name: 'Скрыть клавиатуру' })
    .click()
    .catch(() => undefined)
  await card.getByRole('button', { name: 'Подход выполнен' }).first().click()
  await expect(card.getByRole('button', { name: 'Снять отметку' })).toHaveCount(2)

  // Завершить: неотмеченный третий подход пустой — выбрасывается.
  await workout.getByRole('button', { name: 'Завершить', exact: true }).click()
  await page.getByRole('button', { name: 'Завершить тренировку' }).click()

  const summary = page.getByRole('dialog', { name: 'Итоги тренировки' })
  await expect(summary.getByText('Тренировка завершена')).toBeVisible()
  await expect(summary.getByText(/^1\s000$/)).toBeVisible() // 62,5 × 8 × 2
  await summary.getByRole('button', { name: 'Отлично' }).click()
  await summary.getByRole('button', { name: 'Готово' }).click()

  await expect(page.getByText('Последние')).toBeVisible()
  expect(await countRows(page, 'workouts')).toBe(1)
})

test('подсказки прошлого раза и рекорд', async ({ page }) => {
  await fixToday(page)
  await seedLegacyDatabase(page)
  await page.goto('/')
  await page.getByRole('button', { name: 'Отлично' }).click()

  // Программа из первой версии: жим лёжа, подтягивания, тяга, планка.
  await page
    .getByRole('button', { name: /День A — верх/ })
    .first()
    .click()
  await page.getByRole('dialog').getByRole('button', { name: 'Начать тренировку' }).click()
  const workout = page.getByRole('dialog', { name: /^Тренировка/ })
  const bench = workout.getByRole('article', { name: 'Жим лёжа' })

  // Колонка «Прошлый раз» — из последней тренировки (2 октября жим не делали — берётся 30 сентября).
  await expect(bench.getByRole('button', { name: /Прошлый раз 77,5 × 8/ }).first()).toBeVisible()

  // 80 × 8 после 77,5 × 8 — рекорд.
  await bench.getByRole('button', { name: /^Вес/ }).first().click()
  await expect(page.getByRole('group', { name: /Ввод: Вес/ })).toBeVisible()
  await page.keyboard.type('80')
  await page.keyboard.press('Enter')
  await page.keyboard.type('8')
  await page.keyboard.press('Enter')
  await expect(bench.getByRole('button', { name: /рекорд/ })).toBeVisible()
})
