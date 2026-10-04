import type { Equipment, ExerciseKind, MuscleGroup } from '@/domain/types'

export interface CatalogItem {
  id: string
  name: string
  muscle: MuscleGroup
  kind: ExerciseKind
  equipment: Equipment
}

type Row = [slug: string, name: string, kind: ExerciseKind, equipment: Equipment]

/**
 * Встроенный каталог. id стабильны (`c:<slug>`): по ним к упражнению привязана история,
 * поэтому их нельзя менять — только добавлять новые.
 * Названия из первой версии дневника сохранены дословно: при переносе данных
 * старые записи находят свои упражнения по имени.
 */
const ROWS: Record<MuscleGroup, Row[]> = {
  chest: [
    ['bench-press', 'Жим лёжа', 'strength', 'barbell'],
    ['incline-bench-press', 'Жим лёжа на наклонной скамье', 'strength', 'barbell'],
    ['dumbbell-press', 'Жим гантелей лёжа', 'strength', 'dumbbell'],
    ['incline-dumbbell-press', 'Жим гантелей на наклонной', 'strength', 'dumbbell'],
    ['dumbbell-fly', 'Разводка гантелей', 'strength', 'dumbbell'],
    ['cable-crossover', 'Сведение в кроссовере', 'strength', 'cable'],
    ['machine-chest-press', 'Жим от груди в тренажёре', 'strength', 'machine'],
    ['pec-deck', 'Бабочка', 'strength', 'machine'],
    ['dips', 'Отжимания на брусьях', 'bodyweight', 'bodyweight'],
    ['push-ups', 'Отжимания от пола', 'bodyweight', 'bodyweight'],
    ['dumbbell-pullover', 'Пуловер с гантелью', 'strength', 'dumbbell'],
  ],
  back: [
    ['pull-ups', 'Подтягивания', 'bodyweight', 'bodyweight'],
    ['chin-ups', 'Подтягивания обратным хватом', 'bodyweight', 'bodyweight'],
    ['lat-pulldown', 'Вертикальная тяга блока', 'strength', 'cable'],
    ['seated-cable-row', 'Горизонтальная тяга блока', 'strength', 'cable'],
    ['barbell-row', 'Тяга штанги в наклоне', 'strength', 'barbell'],
    ['dumbbell-row', 'Тяга гантели в наклоне', 'strength', 'dumbbell'],
    ['t-bar-row', 'Тяга Т-грифа', 'strength', 'barbell'],
    ['deadlift', 'Становая тяга', 'strength', 'barbell'],
    ['hyperextension', 'Гиперэкстензия', 'bodyweight', 'bodyweight'],
    ['straight-arm-pulldown', 'Пуловер на блоке', 'strength', 'cable'],
    ['shrugs', 'Шраги', 'strength', 'dumbbell'],
  ],
  legs: [
    ['squat', 'Приседания со штангой', 'strength', 'barbell'],
    ['front-squat', 'Фронтальные приседания', 'strength', 'barbell'],
    ['goblet-squat', 'Гоблет-приседания', 'strength', 'dumbbell'],
    ['leg-press', 'Жим ногами', 'strength', 'machine'],
    ['hack-squat', 'Гакк-приседания', 'strength', 'machine'],
    ['leg-extension', 'Разгибание ног', 'strength', 'machine'],
    ['leg-curl', 'Сгибание ног', 'strength', 'machine'],
    ['lunges', 'Выпады', 'strength', 'dumbbell'],
    ['bulgarian-split-squat', 'Болгарские выпады', 'strength', 'dumbbell'],
    ['romanian-deadlift', 'Румынская тяга', 'strength', 'barbell'],
    ['hip-thrust', 'Ягодичный мост', 'strength', 'barbell'],
    ['hip-adduction', 'Сведение ног в тренажёре', 'strength', 'machine'],
    ['hip-abduction', 'Разведение ног в тренажёре', 'strength', 'machine'],
    ['standing-calf-raise', 'Подъём на носки', 'strength', 'machine'],
    ['seated-calf-raise', 'Подъём на носки сидя', 'strength', 'machine'],
  ],
  shoulders: [
    ['overhead-press', 'Жим штанги стоя', 'strength', 'barbell'],
    ['seated-dumbbell-press', 'Жим гантелей сидя', 'strength', 'dumbbell'],
    ['arnold-press', 'Жим Арнольда', 'strength', 'dumbbell'],
    ['lateral-raise', 'Махи гантелями в стороны', 'strength', 'dumbbell'],
    ['front-raise', 'Подъём гантелей перед собой', 'strength', 'dumbbell'],
    ['rear-delt-fly', 'Махи в наклоне', 'strength', 'dumbbell'],
    ['reverse-pec-deck', 'Обратная бабочка', 'strength', 'machine'],
    ['upright-row', 'Тяга штанги к подбородку', 'strength', 'barbell'],
    ['face-pull', 'Тяга каната к лицу', 'strength', 'cable'],
    ['cable-lateral-raise', 'Махи в кроссовере', 'strength', 'cable'],
  ],
  biceps: [
    ['barbell-curl', 'Штанга на бицепс', 'strength', 'barbell'],
    ['dumbbell-curl', 'Подъём гантелей на бицепс', 'strength', 'dumbbell'],
    ['hammer-curl', 'Молотки', 'strength', 'dumbbell'],
    ['preacher-curl', 'Сгибания на скамье Скотта', 'strength', 'barbell'],
    ['concentration-curl', 'Концентрированные сгибания', 'strength', 'dumbbell'],
    ['cable-curl', 'Сгибания на блоке', 'strength', 'cable'],
  ],
  triceps: [
    ['skull-crusher', 'Французский жим', 'strength', 'barbell'],
    ['triceps-pushdown', 'Разгибания рук на блоке', 'strength', 'cable'],
    ['close-grip-push-ups', 'Отжимания узким хватом', 'bodyweight', 'bodyweight'],
    ['close-grip-bench', 'Жим лёжа узким хватом', 'strength', 'barbell'],
    ['overhead-extension', 'Разгибание гантели из-за головы', 'strength', 'dumbbell'],
    ['bench-dips', 'Отжимания от скамьи', 'bodyweight', 'bodyweight'],
  ],
  core: [
    ['incline-sit-up', 'Пресс под градусом', 'bodyweight', 'bodyweight'],
    ['crunches', 'Скручивания', 'bodyweight', 'bodyweight'],
    ['hanging-leg-raise', 'Подъём ног в висе', 'bodyweight', 'bodyweight'],
    ['plank', 'Планка', 'timed', 'bodyweight'],
    ['side-plank', 'Боковая планка', 'timed', 'bodyweight'],
    ['cable-crunch', 'Скручивания на блоке', 'strength', 'cable'],
    ['bicycle-crunch', 'Велосипед', 'bodyweight', 'bodyweight'],
    ['ab-wheel', 'Ролик для пресса', 'bodyweight', 'other'],
    ['russian-twist', 'Русские скручивания', 'bodyweight', 'bodyweight'],
  ],
  cardio: [
    ['treadmill', 'Беговая дорожка', 'cardio', 'machine'],
    ['exercise-bike', 'Велотренажёр', 'cardio', 'machine'],
    ['elliptical', 'Эллипс', 'cardio', 'machine'],
    ['rowing-machine', 'Гребной тренажёр', 'cardio', 'machine'],
    ['stair-climber', 'Степпер', 'cardio', 'machine'],
    ['running', 'Бег на улице', 'cardio', 'other'],
    ['walking', 'Ходьба', 'cardio', 'other'],
    ['cycling', 'Велосипед на улице', 'cardio', 'other'],
    ['swimming', 'Плавание', 'cardio', 'other'],
    ['jump-rope', 'Скакалка', 'timed', 'other'],
  ],
  other: [
    ['kettlebell-swing', 'Махи гирей', 'strength', 'kettlebell'],
    ['farmers-walk', 'Прогулка фермера', 'timed', 'dumbbell'],
    ['burpees', 'Бёрпи', 'bodyweight', 'bodyweight'],
    ['stretching', 'Растяжка', 'timed', 'other'],
  ],
}

export const CATALOG: readonly CatalogItem[] = Object.entries(ROWS).flatMap(([muscle, rows]) =>
  rows.map(([slug, name, kind, equipment]) => ({
    id: `c:${slug}`,
    name,
    muscle: muscle as MuscleGroup,
    kind,
    equipment,
  })),
)
