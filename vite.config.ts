import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import pkg from './package.json' with { type: 'json' }

// На GitHub Pages приложение живёт по подпути /training-diary/ — его задаёт workflow.
// Локально (dev, preview, e2e) — корень «/».
const base = process.env.BASE_PATH ?? '/'

function gitCommit(): string {
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim()
  } catch {
    return 'dev'
  }
}

export default defineConfig({
  base,
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __APP_COMMIT__: JSON.stringify(gitCommit()),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString()),
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // Новый worker сразу берёт управление (skipWaiting + clientsClaim).
      // Когда перезагрузить страницу, решает src/app/serviceWorker.ts.
      registerType: 'autoUpdate',
      injectRegister: false,
      manifest: {
        id: base,
        name: 'Дневник тренировок',
        short_name: 'Тренировки',
        description: 'Личный дневник тренировок: подходы, веса, рекорды и прогресс',
        lang: 'ru',
        dir: 'ltr',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#f2f2f7',
        theme_color: '#f2f2f7',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Плагин включает их сам только при своей регистрации, а у нас своя — задаём явно.
        // Без этого новая версия ждала бы, пока закроют все окна, а на iPhone это «никогда».
        skipWaiting: true,
        clientsClaim: true,
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  build: {
    // Один чанк намеренно: после обновления старая страница не должна просить
    // ленивые чанки, которых уже нет ни на сервере, ни в новом кэше. Всё равно грузится из кэша.
    chunkSizeWarningLimit: 900,
  },
  // Для проверки с телефона по локальной сети: `pnpm dev --host`.
  server: { host: '127.0.0.1', port: 5173 },
  preview: { host: '127.0.0.1', port: 4173 },
})
