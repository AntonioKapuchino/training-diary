import { defineConfig, devices } from '@playwright/test'

const PORT = 4173

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    locale: 'ru-RU',
    timezoneId: 'Europe/Moscow',
    trace: 'retain-on-failure',
    // Без выезда шторок: иначе под нагрузкой WebKit клик иногда приходится на кнопку,
    // которая ещё едет, и уходит мимо. Приложение уважает эту настройку системы.
    contextOptions: { reducedMotion: 'reduce' },
  },
  projects: [
    {
      // Основная цель — Safari на iPhone. Высота — как у приложения с домашнего экрана,
      // без панелей браузера.
      name: 'iphone',
      use: { ...devices['iPhone 15 Pro'], viewport: { width: 393, height: 852 } },
    },
    {
      name: 'android',
      use: { ...devices['Pixel 7'] },
    },
  ],
  webServer: {
    command: `pnpm build && pnpm preview --port ${PORT} --strictPort`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
})
