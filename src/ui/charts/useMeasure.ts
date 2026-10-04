import { useLayoutEffect, useRef, useState } from 'react'

/** Ширина контейнера: график рисуется в настоящих пикселях, без растяжения. */
export function useMeasure<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    setWidth(el.clientWidth)
    const ro = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.round(entry.contentRect.width))
    })
    ro.observe(el)
    return () => {
      ro.disconnect()
    }
  }, [])
  return [ref, width] as const
}
