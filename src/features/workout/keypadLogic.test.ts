import { describe, expect, it } from 'vitest'
import { fieldsFor, type FieldSpec } from '@/domain/sets'
import { displayDraft, draftOf, pressKey, stepValue, valueOf, type Key } from './keypadLogic'

const [weight, reps] = fieldsFor('strength')
const [time] = fieldsFor('timed')
if (!weight || !reps || !time) throw new Error('fields')

function type(spec: FieldSpec, keys: Key[], start = '', fresh = true): string {
  let draft = start
  for (const k of keys) {
    draft = pressKey(spec, draft, k, fresh)
    fresh = false
  }
  return draft
}

describe('клавиатура: вес', () => {
  it('первое нажатие заменяет старое значение', () => {
    expect(type(weight, ['7', '0'], '62.5')).toBe('70')
  })
  it('запятая и дробная часть не длиннее двух знаков', () => {
    expect(type(weight, ['5', '2', ',', '5'])).toBe('52.5')
    expect(displayDraft(weight, '52.')).toBe('52,')
    expect(type(weight, ['1', ',', '2', '5', '9'])).toBe('1.25')
    expect(type(weight, [',', '5'])).toBe('0.5')
  })
  it('стирание: первое — всё, дальше по символу', () => {
    expect(type(weight, ['back'], '62.5')).toBe('')
    expect(pressKey(weight, '62.5', 'back', false)).toBe('62.')
  })
  it('без ведущих нулей и не длиннее четырёх цифр', () => {
    expect(type(weight, ['0', '5'])).toBe('5')
    expect(type(weight, ['1', '2', '3', '4', '5'])).toBe('1234')
  })
  it('значение', () => {
    expect(valueOf(weight, '52.')).toBe(52)
    expect(valueOf(weight, '')).toBeUndefined()
  })
})

describe('клавиатура: повторы', () => {
  it('без запятой', () => {
    expect(type(reps, ['1', ',', '2'])).toBe('12')
  })
})

describe('клавиатура: время', () => {
  it('цифры заполняют «м:сс» справа, как таймер iOS', () => {
    const d = type(time, ['1', '3', '0'])
    expect(d).toBe('130')
    expect(valueOf(time, d)).toBe(90)
    expect(displayDraft(time, d)).toBe('1:30')
    expect(displayDraft(time, '5')).toBe('0:05')
  })
  it('черновик из секунд и обратно', () => {
    expect(draftOf(time, 90)).toBe('130')
    expect(draftOf(time, 3725)).toBe('10205')
    expect(valueOf(time, '10205')).toBe(3725)
  })
})

describe('шаг «−»/«+»', () => {
  it('от подсказки, если ячейка пустая', () => {
    expect(stepValue(undefined, 60, 2.5, 1)).toBe(62.5)
    expect(stepValue(61, undefined, 2.5, 1)).toBe(62.5)
    expect(stepValue(1, undefined, 2.5, -1)).toBe(0)
  })
})
