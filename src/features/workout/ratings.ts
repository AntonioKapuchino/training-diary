/** Самочувствие после тренировки — пять ступеней. */
export const RATINGS = [
  { value: 1, emoji: '😫', label: 'Тяжело' },
  { value: 2, emoji: '😕', label: 'Так себе' },
  { value: 3, emoji: '😐', label: 'Нормально' },
  { value: 4, emoji: '🙂', label: 'Хорошо' },
  { value: 5, emoji: '💪', label: 'Отлично' },
] as const

export function ratingOf(value: number | undefined) {
  return RATINGS.find((r) => r.value === value)
}
