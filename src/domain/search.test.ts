import { describe, expect, it } from 'vitest'
import { normalizeText, sameName, searchItems, searchScore } from './search'

const names = [
  'Подъём на носки',
  'Подъём гантелей на бицепс',
  'Жим лёжа',
  'Жим гантелей лёжа',
  'Велотренажёр',
  'Подтягивания',
]

describe('поиск упражнений', () => {
  it('«е» находит «ё» — иначе появляются дубли упражнений', () => {
    expect(searchItems(names, 'подъем', (x) => x)).toEqual([
      'Подъём на носки',
      'Подъём гантелей на бицепс',
    ])
    expect(searchItems(names, 'велотренажер', (x) => x)).toEqual(['Велотренажёр'])
  })
  it('слова запроса — начала слов названия', () => {
    expect(searchItems(names, 'жим гант', (x) => x)).toEqual(['Жим гантелей лёжа'])
    expect(searchItems(names, 'лежа жим', (x) => x)).toEqual(['Жим лёжа', 'Жим гантелей лёжа'])
  })
  it('точное совпадение выше частичного', () => {
    expect(searchScore('Жим лёжа', 'Жим лёжа')).toBeGreaterThan(searchScore('жим', 'Жим лёжа'))
    expect(searchItems(names, 'жим', (x) => x)[0]).toBe('Жим лёжа')
  })
  it('пустой запрос возвращает всё', () => {
    expect(searchItems(names, '  ', (x) => x)).toHaveLength(names.length)
  })
  it('нормализует пунктуацию и регистр', () => {
    expect(normalizeText('  Жим   Арнольда! ')).toBe('жим арнольда')
    expect(sameName('Подъём ног в висе', 'подъем  ног в висе')).toBe(true)
  })
  it('разложенная «ё» и названия из значков', () => {
    expect(sameName('Подъе\u0308м на носки', 'подъем на носки')).toBe(true)
    expect(sameName('💪', '🔥')).toBe(false)
    expect(sameName('💪', ' 💪 ')).toBe(true)
  })
})
