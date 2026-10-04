import { describe, expect, it } from 'vitest'
import type { WorkoutSet } from '@/domain/types'
import { fillHints, matchPrevious } from './hints'

const s = (type: WorkoutSet['type'], v: Partial<WorkoutSet> = {}): WorkoutSet => ({
  id: Math.random().toString(36),
  type,
  done: false,
  ...v,
})

describe('подсказки прошлого раза', () => {
  it('разминка не сдвигает рабочие подходы', () => {
    const previous = [s('normal', { weight: 60, reps: 8 }), s('normal', { weight: 62.5, reps: 6 })]
    const now = [s('warmup'), s('normal'), s('normal'), s('normal')]
    expect(matchPrevious(now, previous)).toEqual([
      undefined,
      { weight: 60, reps: 8 },
      { weight: 62.5, reps: 6 },
      undefined,
    ])
  })

  it('лишний подход заполняется значениями подхода выше', () => {
    const now = [s('normal', { weight: 60, reps: 8 }), s('normal')]
    expect(fillHints(now, [undefined, undefined])).toEqual([undefined, { weight: 60, reps: 8 }])
  })

  it('прошлый раз важнее подхода выше', () => {
    const now = [s('normal', { weight: 70, reps: 5 }), s('normal')]
    expect(
      fillHints(now, [
        { weight: 60, reps: 8 },
        { weight: 60, reps: 8 },
      ])[1],
    ).toEqual({
      weight: 60,
      reps: 8,
    })
  })
})
