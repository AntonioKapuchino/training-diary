import { useEffect, useState } from 'react'

/** Текущее время с заданным шагом — для таймеров на экране. */
export function useNow(intervalMs = 1000, enabled = true): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!enabled) return
    // Пока часы стояли, время ушло вперёд: без этого только что запущенный таймер
    // четверть секунды показывал бы «11:30» вместо «1:30». Обновляем сразу, не ждя шага.
    const first = setTimeout(() => {
      setNow(Date.now())
    }, 0)
    const id = setInterval(() => {
      setNow(Date.now())
    }, intervalMs)
    return () => {
      clearTimeout(first)
      clearInterval(id)
    }
  }, [intervalMs, enabled])
  return now
}
