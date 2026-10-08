import { useEffect, useLayoutEffect, useRef } from 'react'
import { NavigationType, useLocation, useNavigationType } from 'react-router'

const positions = new Map<string, number>()

/**
 * Прокрутка, как в iOS: новый экран открывается сверху, а «назад» возвращает туда,
 * где остановился. Штатный ScrollRestoration прокручивает один раз, пока данные
 * страницы ещё грузятся и она короткая, — и позиция обрезается до верха.
 * Здесь прокрутка повторяется, пока страница не дорастёт до нужной высоты.
 */
export function ScrollMemory() {
  const location = useLocation()
  const type = useNavigationType()
  const current = useRef(location.key)

  useEffect(() => {
    // Браузер сам не восстанавливает: этим занимаемся мы, иначе он прыгнет первым.
    window.history.scrollRestoration = 'manual'
    const save = () => {
      positions.set(current.current, window.scrollY)
    }
    window.addEventListener('scroll', save, { passive: true })
    return () => {
      window.removeEventListener('scroll', save)
    }
  }, [])

  useLayoutEffect(() => {
    current.current = location.key
    const target = type === NavigationType.Pop ? (positions.get(location.key) ?? 0) : 0
    window.scrollTo(0, target)
    if (target === 0) return
    let frames = 0
    let raf = 0
    const tick = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight
      window.scrollTo(0, Math.min(target, max))
      // Секунды хватает живым запросам к базе; дальше не спорим с пальцем пользователя.
      if (max < target && ++frames < 60) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
    }
  }, [location.key, type])

  return null
}
