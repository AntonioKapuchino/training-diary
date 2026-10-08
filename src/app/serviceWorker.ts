import { Workbox } from 'workbox-window'
import { getWorkoutUi } from '@/features/workout/store'
import { FLUSH_EVENT } from '@/lib/useDebouncedSave'

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

/** Перезагрузка без потерь: сначала дописываются заметки, которые ещё ждут сохранения. */
function reloadSafely(): void {
  window.dispatchEvent(new Event(FLUSH_EVENT))
  setTimeout(() => {
    window.location.reload()
  }, 300)
}

export function registerServiceWorker(onPending: () => void): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator) || wb) return
  wb = new Workbox(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL })
  // event.isUpdate в workbox-window запоминается один раз при регистрации: после первой
  // установки он навсегда false, и обновление в той же сессии прошло бы мимо. Считаем сами.
  let controlled = navigator.serviceWorker.controller !== null
  wb.addEventListener('controlling', () => {
    const isUpdate = controlled
    controlled = true
    // Первая установка — перезагружать нечего.
    if (!isUpdate) return
    if (document.visibilityState === 'hidden' || !busy()) reloadSafely()
    else {
      pending = true
      onPending()
    }
  })
  void wb.register()

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && pending) reloadSafely()
    // Приложение с экрана «Домой» живёт днями — проверяем обновления при каждом возврате.
    if (document.visibilityState === 'visible') void wb?.update()
  })
  setInterval(() => void wb?.update(), 60 * 60 * 1000)
}

export function reloadNow(): void {
  reloadSafely()
}
