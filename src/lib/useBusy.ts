import { useCallback, useRef, useState } from 'react'

/**
 * Асинхронное действие, которое нельзя запустить второй раз, пока идёт первое:
 * двойное касание «Сохранить как программу» иначе создало бы две программы.
 */
export function useBusy(): [boolean, (fn: () => Promise<unknown>) => Promise<void>] {
  const [busy, setBusy] = useState(false)
  const running = useRef(false)
  const run = useCallback(async (fn: () => Promise<unknown>) => {
    if (running.current) return
    running.current = true
    setBusy(true)
    try {
      await fn()
    } finally {
      running.current = false
      setBusy(false)
    }
  }, [])
  return [busy, run]
}
