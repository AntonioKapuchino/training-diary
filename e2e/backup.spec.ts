import { expect, test } from '@playwright/test'
import { countRows, fixToday, legacyBackupPath } from './helpers'

test('копия первой версии загружается из файла, а своя — сохраняется и восстанавливается', async ({
  page,
}, testInfo) => {
  await fixToday(page)
  // Меню «Поделиться» в тесте не открыть — пусть копия скачивается файлом.
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true })
  })
  await page.goto('/#/settings/data')

  // Загрузка бэкапа первой версии.
  await page.locator('input[type=file]').setInputFiles(legacyBackupPath)
  const sheet = page.getByRole('dialog', { name: 'Загрузить копию?' })
  await expect(sheet.getByText('Копия первой версии дневника')).toBeVisible()
  await expect(sheet.getByText('6 тренировок')).toBeVisible()
  await sheet.getByRole('button', { name: 'Заменить данные' }).click()
  await expect(page.getByText('Загружено: 6 тренировок')).toBeVisible()
  expect(await countRows(page, 'workouts')).toBe(6)

  // Своя копия: без меню «Поделиться» — скачивание файла.
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: /Копия в Файлы/ }).click()
  const file = testInfo.outputPath('backup.json')
  await (await download).saveAs(file)

  // Портим данные и восстанавливаем из своего файла.
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const req = indexedDB.open('training-diary-v3')
        req.onsuccess = () => {
          const tx = req.result.transaction('workouts', 'readwrite')
          tx.objectStore('workouts').clear()
          tx.oncomplete = () => {
            req.result.close()
            resolve()
          }
        }
      }),
  )
  expect(await countRows(page, 'workouts')).toBe(0)
  await page.locator('input[type=file]').setInputFiles(file)
  await expect(
    page.getByRole('dialog', { name: 'Загрузить копию?' }).getByText('Резервная копия'),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Заменить данные' }).click()
  await expect.poll(() => countRows(page, 'workouts')).toBe(6)

  // Перед каждой заменой — снимок на устройстве.
  await expect(page.getByText('Снимки на устройстве')).toBeVisible()
})

test('чужой файл — понятная ошибка, данные не трогаются', async ({ page }, testInfo) => {
  await page.goto('/#/settings/data')
  const bad = testInfo.outputPath('notes.json')
  const { writeFileSync } = await import('node:fs')
  writeFileSync(bad, JSON.stringify({ hello: 'world' }))
  await page.locator('input[type=file]').setInputFiles(bad)
  await expect(
    page.getByText('Файл не похож на резервную копию дневника тренировок.'),
  ).toBeVisible()
})
