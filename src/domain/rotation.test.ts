import { describe, expect, it } from 'vitest'
import { nextInRotation } from './rotation'

const DAY = 86_400_000
const NOW = Date.parse('2026-10-08T12:00:00+03:00')
const t = (id: string, order: number) => ({ id, order })
const A = t('a', 0)
const B = t('b', 1)
const C = t('c', 2)
const D = t('d', 3)
const w = (templateId: string, daysAgo: number) => ({ templateId, startedAt: NOW - daysAgo * DAY })

describe('следующая по программе', () => {
  it('без программ — ничего, без истории — первая', () => {
    expect(nextInRotation<typeof A>([], [], NOW)).toBeUndefined()
    expect(nextInRotation([B, A], [], NOW)?.id).toBe('a')
  })

  it('после последней сделанной — следующая по кругу', () => {
    const history = [w('a', 5), w('b', 3)]
    expect(nextInRotation([A, B, C], history, NOW)?.id).toBe('c')
    expect(nextInRotation([A, B, C], [...history, w('c', 1)], NOW)?.id).toBe('a')
  })

  it('новая программа, по которой ещё не занимался, в круге', () => {
    expect(nextInRotation([A, B, C, D], [w('a', 6), w('b', 4), w('c', 2)], NOW)?.id).toBe('d')
  })

  it('программа, которой давно не пользовались, в круг не попадает', () => {
    const history = [w('d', 120), w('a', 6), w('b', 4), w('c', 2)]
    expect(nextInRotation([A, B, C, D], history, NOW)?.id).toBe('a')
  })

  it('если в ходу одна программа, по кругу идут все', () => {
    expect(nextInRotation([A, B, C], [w('a', 2)], NOW)?.id).toBe('b')
  })

  it('тренировки без программы и с удалённой программой не мешают', () => {
    const history = [w('a', 4), { startedAt: NOW - 2 * DAY }, w('удалена', 1)]
    expect(nextInRotation([A, B], history, NOW)?.id).toBe('b')
  })
})
