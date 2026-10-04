import { describe, expect, it } from 'vitest'
import { normalizeText } from '@/domain/search'
import { CATALOG } from './catalog'

/** Встроенный каталог первой версии: [название, тип учёта]. */
const LEGACY_SEED: [string, string][] = [
  ['Жим лёжа', 'strength'],
  ['Жим гантелей на наклонной', 'strength'],
  ['Разводка гантелей', 'strength'],
  ['Сведение в кроссовере', 'strength'],
  ['Отжимания на брусьях', 'bodyweight'],
  ['Подтягивания', 'bodyweight'],
  ['Вертикальная тяга блока', 'strength'],
  ['Горизонтальная тяга блока', 'strength'],
  ['Тяга штанги в наклоне', 'strength'],
  ['Становая тяга', 'strength'],
  ['Приседания со штангой', 'strength'],
  ['Жим ногами', 'strength'],
  ['Разгибание ног', 'strength'],
  ['Сгибание ног', 'strength'],
  ['Выпады', 'strength'],
  ['Подъём на носки', 'strength'],
  ['Жим штанги стоя', 'strength'],
  ['Жим гантелей сидя', 'strength'],
  ['Махи гантелями в стороны', 'strength'],
  ['Подъём гантелей перед собой', 'strength'],
  ['Штанга на бицепс', 'strength'],
  ['Подъём гантелей на бицепс', 'strength'],
  ['Молотки', 'strength'],
  ['Французский жим', 'strength'],
  ['Разгибания рук на блоке', 'strength'],
  ['Отжимания узким хватом', 'bodyweight'],
  ['Пресс под градусом', 'bodyweight'],
  ['Скручивания', 'bodyweight'],
  ['Подъём ног в висе', 'bodyweight'],
  ['Планка', 'timed'],
  ['Беговая дорожка', 'cardio'],
  ['Велотренажёр', 'cardio'],
  ['Эллипс', 'cardio'],
]

describe('встроенный каталог', () => {
  it('содержит все упражнения первой версии с тем же типом учёта', () => {
    for (const [name, kind] of LEGACY_SEED) {
      expect(CATALOG.find((c) => c.name === name)?.kind, name).toBe(kind)
    }
  })
  it('id и названия уникальны', () => {
    expect(new Set(CATALOG.map((c) => c.id)).size).toBe(CATALOG.length)
    expect(new Set(CATALOG.map((c) => normalizeText(c.name))).size).toBe(CATALOG.length)
  })
})
