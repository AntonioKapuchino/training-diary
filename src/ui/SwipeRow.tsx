import { Trash2 } from 'lucide-react'
import { animate, motion, useMotionValue, useTransform } from 'motion/react'
import type { ReactNode } from 'react'

interface Props {
  children: ReactNode
  onDelete: () => void
  label?: string
  disabled?: boolean
}

const REVEAL = 84

/**
 * Свайп влево, как в списках iOS: открывает «Удалить», длинный свайп удаляет сразу.
 * Вертикальная прокрутка не мешает: направление фиксируется в начале жеста.
 */
export function SwipeRow({ children, onDelete, label = 'Удалить', disabled }: Props) {
  const x = useMotionValue(0)
  const opacity = useTransform(x, [-REVEAL, -24, 0], [1, 0.6, 0])
  if (disabled) return <>{children}</>
  return (
    <div className="relative overflow-hidden">
      <motion.button
        type="button"
        aria-label={label}
        style={{ opacity }}
        onClick={onDelete}
        className="absolute inset-y-0 right-0 flex w-[5.25rem] items-center justify-center bg-danger text-white"
        tabIndex={-1}
      >
        <Trash2 className="size-5" />
      </motion.button>
      <motion.div
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: -REVEAL, right: 0 }}
        dragElastic={{ left: 0.5, right: 0 }}
        dragMomentum={false}
        style={{ x }}
        className="relative bg-surface"
        onDragEnd={(_, info) => {
          if (info.offset.x < -170) {
            onDelete()
            return
          }
          void animate(x, x.get() < -REVEAL / 2 ? -REVEAL : 0, {
            type: 'spring',
            stiffness: 500,
            damping: 40,
          })
        }}
        onClickCapture={(e) => {
          // Открытую строку касание закрывает, а не нажимает кнопку под пальцем.
          if (x.get() < -4) {
            e.stopPropagation()
            void animate(x, 0, { type: 'spring', stiffness: 500, damping: 40 })
          }
        }}
      >
        {children}
      </motion.div>
    </div>
  )
}
