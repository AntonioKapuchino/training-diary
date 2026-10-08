import { useCallback, useState } from 'react'

const memory = new Map<string, unknown>()

/**
 * useState, который переживает уход со страницы и возврат назад: выбранный месяц истории,
 * период прогресса, фильтр упражнений. Живёт до перезапуска приложения, как в iOS.
 */
export function useSessionState<T>(key: string, initial: T): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => (memory.has(key) ? (memory.get(key) as T) : initial))
  const set = useCallback(
    (next: T) => {
      memory.set(key, next)
      setValue(next)
    },
    [key],
  )
  return [value, set]
}
