import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'

interface ToastData {
  id: number
  message: string
  action?: { label: string; onAction: () => void }
  duration: number
}

let current: ToastData | null = null
let seq = 0
const listeners = new Set<() => void>()
const emit = () => {
  for (const l of listeners) l()
}

/** Короткое сообщение внизу экрана; с action — «Отменить» для удалений. */
export function toast(message: string, action?: ToastData['action'], duration = 4500): void {
  current = { id: ++seq, message, duration, ...(action ? { action } : {}) }
  emit()
}

export function dismissToast(): void {
  current = null
  emit()
}

function useToast(): ToastData | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => current,
    () => current,
  )
}

/** Поднимается над таб-баром и мини-плеером тренировки. */
export function Toaster({ offset }: { offset: number }) {
  const t = useToast()
  useEffect(() => {
    if (!t) return
    const timer = setTimeout(() => {
      if (current?.id === t.id) dismissToast()
    }, t.duration)
    return () => {
      clearTimeout(timer)
    }
  }, [t])

  return createPortal(
    <div
      className="pointer-events-none fixed inset-x-0 z-[70] flex justify-center px-4"
      style={{ bottom: `calc(${offset}px + var(--safe-bottom))` }}
      aria-live="polite"
    >
      <AnimatePresence>
        {t && (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 500, damping: 38 }}
            className="pointer-events-auto flex max-w-[30rem] items-center gap-3 rounded-full py-2.5 pr-2.5 pl-5 text-subhead glass"
            role="status"
          >
            <span className="min-w-0 flex-1">{t.message}</span>
            {t.action && (
              <button
                type="button"
                className="shrink-0 press-scale rounded-full bg-accent-soft px-3.5 py-1.5 font-semibold text-accent"
                onClick={() => {
                  t.action?.onAction()
                  dismissToast()
                }}
              >
                {t.action.label}
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>,
    document.body,
  )
}
