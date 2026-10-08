import clsx from 'clsx'
import { AnimatePresence, motion, useIsPresent } from 'motion/react'
import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

export interface Action {
  label: string
  icon?: ReactNode
  destructive?: boolean
  onSelect: () => void
}

interface Props {
  open: boolean
  onClose: () => void
  title?: string
  message?: string
  actions: readonly Action[]
  cancelLabel?: string
}

/** Меню действий iOS: карточка с вариантами и отдельная «Отмена». */
export function ActionSheet({
  open,
  onClose,
  title,
  message,
  actions,
  cancelLabel = 'Отмена',
}: Props) {
  return createPortal(
    <AnimatePresence>
      {open && (
        <ActionSheetBody
          onClose={onClose}
          title={title}
          message={message}
          actions={actions}
          cancelLabel={cancelLabel}
        />
      )}
    </AnimatePresence>,
    document.body,
  )
}

function ActionSheetBody({
  onClose,
  title,
  message,
  actions,
  cancelLabel,
}: Omit<Props, 'open'> & { title: string | undefined; message: string | undefined }) {
  // Меню, которое уже закрывается, касаний не принимает — без двойных действий.
  const present = useIsPresent()
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return (
    <div
      className={clsx(
        'fixed inset-0 z-[60] flex flex-col justify-end',
        !present && 'pointer-events-none',
      )}
      inert={!present}
      role="dialog"
      aria-modal="true"
      aria-label={title ?? 'Действия'}
    >
      <motion.div
        aria-hidden
        className="absolute inset-0 bg-[var(--backdrop)]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        className="relative mx-auto w-full max-w-[32rem] space-y-2 px-2 pb-[max(0.5rem,var(--safe-bottom))]"
        initial={{ y: '110%' }}
        animate={{ y: 0 }}
        exit={{ y: '110%' }}
        transition={{ type: 'spring', stiffness: 460, damping: 40 }}
      >
        <div className="overflow-hidden rounded-[var(--radius-card)] glass-thick">
          {(title ?? message) && (
            <div className="px-4 pt-3.5 pb-3 text-center hairline-b">
              {title && <div className="text-footnote font-semibold text-label-2">{title}</div>}
              {message && <div className="mt-0.5 text-footnote text-label-2">{message}</div>}
            </div>
          )}
          {actions.map((a, i) => (
            <button
              key={a.label}
              type="button"
              onClick={() => {
                onClose()
                a.onSelect()
              }}
              className={clsx(
                'flex min-h-14 w-full items-center justify-center gap-2 pressable px-4 text-[1.25rem]',
                i > 0 && 'hairline-t',
                a.destructive ? 'text-danger' : 'text-accent',
              )}
            >
              {a.icon}
              {a.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="min-h-14 w-full rounded-[var(--radius-card)] pressable text-[1.25rem] font-semibold text-accent glass-thick"
        >
          {cancelLabel}
        </button>
      </motion.div>
    </div>
  )
}
