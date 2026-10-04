import type { ReactNode } from 'react'

interface Props {
  icon: ReactNode
  title: string
  message?: ReactNode
  action?: ReactNode
}

export function EmptyState({ icon, title, message, action }: Props) {
  return (
    <div className="mx-auto flex max-w-xs flex-col items-center px-6 py-12 text-center">
      <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-accent-soft text-accent [&_svg]:size-7">
        {icon}
      </div>
      <h3 className="text-title-3 font-semibold">{title}</h3>
      {message && <p className="mt-1.5 text-subhead text-label-2">{message}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
