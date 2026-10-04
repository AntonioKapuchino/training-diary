import { Workbox } from 'workbox-window'
import { getWorkoutUi } from '@/features/workout/store'

/**
 * Обновления. Новая версия скачивается в фоне и сразу берёт управление
 * (так обновится и первая версия дневника, которая сама умеет только перезагружаться).
 * Перезагрузку не делаем посреди дела: если открыта тренировка или идёт ввод —
 * ждём, пока приложение свернут, и обновляемся незаметно.
 */
let pending = false
let wb: Workbox | undefined

function busy(): boolean {
  const ui = getWorkoutUi()
  const el = document.activeElement
  const typing = el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement
  return ui.expanded || ui.keypad !== null || typing
}

export function registerServiceWorker(onPending: () => void): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator) || wb) return
  wb = new Workbox(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL })
  wb.addEventListener('controlling', (event) => {
    // Первая установка — перезагружать нечего.
    if (!event.isUpdate) return
    if (document.visibilityState === 'hidden' || !busy()) window.location.reload()
    else {
      pending = true
      onPending()
    }
  })
  void wb.register()

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && pending) window.location.reload()
    // Приложение с экрана «Домой» живёт днями — проверяем обновления при каждом возврате.
    if (document.visibilityState === 'visible') void wb?.update()
  })
  setInterval(() => void wb?.update(), 60 * 60 * 1000)
}

export function reloadNow(): void {
  window.location.reload()
}
