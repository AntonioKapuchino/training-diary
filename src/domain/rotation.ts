/** Сколько дней смотреть назад, чтобы понять, какие программы сейчас в ходу. */
const WINDOW_DAYS = 42

/**
 * Следующая программа по кругу: после последней сделанной — следующая по порядку
 * в списке программ. В круге — программы, по которым занимался за последние шесть
 * недель, и новые, по которым ещё не было ни одной тренировки. Заброшенная давно
 * программа очередь не занимает. Если в круге меньше двух — в нём все программы.
 */
export function nextInRotation<T extends { id: string; order: number }>(
  templates: readonly T[],
  workouts: readonly { templateId?: string | undefined; startedAt: number }[],
  now: number,
): T | undefined {
  if (templates.length === 0) return undefined
  const ordered = [...templates].sort((a, b) => a.order - b.order)
  const known = new Set(ordered.map((t) => t.id))
  const used = workouts
    .filter((w) => w.templateId !== undefined && known.has(w.templateId))
    .sort((a, b) => b.startedAt - a.startedAt)
  const last = used[0]
  if (!last) return ordered[0]

  const since = now - WINDOW_DAYS * 86_400_000
  const recent = new Set(used.filter((w) => w.startedAt >= since).map((w) => w.templateId))
  const ever = new Set(used.map((w) => w.templateId))
  const rotation = ordered.filter((t) => recent.has(t.id) || !ever.has(t.id))
  const circle = rotation.length >= 2 ? rotation : ordered
  const i = circle.findIndex((t) => t.id === last.templateId)
  // Последнюю сделанную выкинули из круга (давно не делал) — начинаем круг сначала.
  return circle[(i + 1) % circle.length] ?? circle[0]
}
