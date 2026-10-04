import { useEffect, useState } from 'react'

/**
 * Высота экранной клавиатуры iOS: на столько visualViewport меньше окна.
 * Нужна, чтобы шторка с полем ввода не пряталась под клавиатурой.
 */
export function useKeyboardInset(enabled = true): number {
  const [inset, setInset] = useState(0)
  useEffect(() => {
    const vv = window.visualViewport
    if (!enabled || !vv) return
    const update = () => {
      setInset(Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)))
    }
    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [enabled])
  return enabled ? inset : 0
}
