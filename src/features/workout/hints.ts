import { hasAnyValue, pickValues } from '@/domain/sets'
import type { SetType, TemplateSet, WorkoutSet } from '@/domain/types'

export type Hint = Pick<TemplateSet, 'weight' | 'reps' | 'seconds' | 'distance'>

type Source = Pick<TemplateSet, 'type' | 'weight' | 'reps' | 'seconds' | 'distance'>

const isWarm = (t: SetType) => t === 'warmup'

/**
 * Подсказки «прошлый раз»: k-й разминочный подход сопоставляется с k-м разминочным
 * прошлой тренировки, k-й рабочий — с k-м рабочим. Так добавленная разминка
 * не сдвигает веса рабочих подходов.
 */
export function matchPrevious(
  sets: readonly { type: SetType }[],
  previous: readonly Source[],
): (Hint | undefined)[] {
  const warm = previous.filter((s) => isWarm(s.type))
  const work = previous.filter((s) => !isWarm(s.type))
  let w = 0
  let k = 0
  return sets.map((s) => {
    const p = isWarm(s.type) ? warm[w++] : work[k++]
    return p && hasAnyValue(p) ? pickValues(p) : undefined
  })
}

/**
 * Чем заполнить пустой подход при отметке: прошлым разом, а если его нет —
 * значениями подхода выше (обычно следующий такой же).
 */
export function fillHints(
  sets: readonly WorkoutSet[],
  previous: readonly (Hint | undefined)[],
): (Hint | undefined)[] {
  let above: Hint | undefined
  return sets.map((s, i) => {
    const own = hasAnyValue(s) ? pickValues(s) : undefined
    const hint = previous[i] ?? above
    if (own) above = own
    else if (previous[i]) above = previous[i]
    return hint
  })
}
