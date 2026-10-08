import clsx from 'clsx'
import { MUSCLE_LABEL, muscleColor } from '@/domain/labels'
import type { MuscleGroup } from '@/domain/types'

/** Цветная точка группы мышц. Цвет — только дополнение к подписи рядом. */
export function MuscleDot({
  muscle,
  size = 8,
  className,
}: {
  muscle: MuscleGroup
  size?: number
  className?: string
}) {
  return (
    <span
      aria-hidden
      className={clsx('inline-block shrink-0 rounded-full', className)}
      style={{ width: size, height: size, background: muscleColor(muscle) }}
    />
  )
}

/** Ряд точек групп мышц тренировки с подписью для экранного диктора. */
export function MuscleDots({
  muscles,
  max = 4,
}: {
  muscles: readonly MuscleGroup[]
  max?: number
}) {
  if (muscles.length === 0) return null
  return (
    <span
      className="inline-flex items-center gap-1"
      role="img"
      aria-label={muscles.map((m) => MUSCLE_LABEL[m]).join(', ')}
    >
      {muscles.slice(0, max).map((m) => (
        <MuscleDot key={m} muscle={m} />
      ))}
    </span>
  )
}
