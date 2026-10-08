import { MotionConfig } from 'motion/react'
import { useEffect, useState } from 'react'
import { RouterProvider } from 'react-router/dom'
import { boot } from './boot'
import { router } from './router'

type State = { status: 'loading' } | { status: 'ready' } | { status: 'error'; message: string }

export function App() {
  const [state, setState] = useState<State>({ status: 'loading' })

  useEffect(() => {
    boot().then(
      () => {
        setState({ status: 'ready' })
      },
      (e: unknown) => {
        setState({ status: 'error', message: e instanceof Error ? e.message : String(e) })
      },
    )
  }, [])

  if (state.status === 'loading') return <div className="min-h-dvh bg-bg" aria-busy="true" />
  if (state.status === 'error') return <BootError message={state.message} />
  // «Уменьшить движение» в настройках iPhone: шторки и экраны появляются без выезда.
  return (
    <MotionConfig reducedMotion="user">
      <RouterProvider router={router} />
    </MotionConfig>
  )
}

function BootError({ message }: { message: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 px-8 text-center">
      <h1 className="text-title-2 font-bold">Не открывается хранилище</h1>
      <p className="text-subhead text-label-2">
        Дневник хранит тренировки в памяти браузера, а она сейчас недоступна. Так бывает в приватном
        режиме Safari. Откройте приложение с экрана «Домой» или в обычной вкладке.
      </p>
      <p className="text-footnote text-label-3">{message}</p>
    </div>
  )
}
