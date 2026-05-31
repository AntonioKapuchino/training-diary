import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// На GitHub Pages приложение живёт по подпути /<repo>/.
// Локально (dev и обычный build/preview) — на корне «/».
// Workflow задаёт BASE_PATH=/training-diary/ при сборке для Pages.
const base = process.env.BASE_PATH || '/'

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Дневник тренировок',
        short_name: 'Тренировки',
        description: 'Личный дневник тренировок: упражнения, веса, прогресс',
        theme_color: '#5B5BD6',
        background_color: '#F7F7F9',
        display: 'standalone',
        orientation: 'portrait',
        lang: 'ru',
        scope: base,
        start_url: base,
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml' },
        ],
      },
    }),
  ],
  server: { host: true, port: 5173, allowedHosts: true },
  preview: { host: true, port: 4173, allowedHosts: true },
})
