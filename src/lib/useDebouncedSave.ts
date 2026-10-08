import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react'

/** Перед перезагрузкой (обновление версии) — дописать всё незаписанное. */
export const FLUSH_EVENT = 'td:flush-saves'

/**
 * Сохранение текста с задержкой. Незаписанное сохраняется и при уходе с экрана,
 * и при сворачивании приложения — заметка не теряется, даже если фокус не ушёл с поля.
 */
export function useDebouncedSave(save: (value: string) => void, delay = 600) {
  const pending = useRef<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const saveRef = useRef(save)
  useLayoutEffect(() => {
    saveRef.current = save
  })

  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = undefined
    if (pending.current !== null) {
      saveRef.current(pending.current)
      pending.current = null
    }
  }, [])

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') flush()
    }
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', flush)
    window.addEventListener(FLUSH_EVENT, flush)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('pagehide', flush)
      window.removeEventListener(FLUSH_EVENT, flush)
      flush()
    }
  }, [flush])

  const change = useCallback(
    (value: string) => {
      pending.current = value
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(flush, delay)
    },
    [delay, flush],
  )

  return useMemo(() => ({ change, flush }), [change, flush])
}
