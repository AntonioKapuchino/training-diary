/**
 * Нормализация для поиска: регистр, «ё» → «е», пунктуация → пробел.
 * Иначе «подъем» не находит «Подъём на носки» — и пользователь заводит дубль.
 */
export function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

/**
 * Насколько текст подходит под запрос: 0 — не подходит.
 * Каждое слово запроса должно быть началом какого-нибудь слова текста
 * («жим гант» → «Жим гантелей лёжа»), либо запрос — подстрокой.
 */
export function searchScore(query: string, text: string): number {
  const q = normalizeText(query)
  if (q === '') return 1
  const t = normalizeText(text)
  if (t === q) return 100
  if (t.startsWith(q)) return 80
  const words = t.split(' ')
  const tokens = q.split(' ')
  if (tokens.every((tok) => words.some((w) => w.startsWith(tok)))) {
    return words[0]?.startsWith(tokens[0] ?? '') ? 70 : 60
  }
  if (t.includes(q)) return 40
  return 0
}

/** Фильтрует и сортирует по релевантности; при равенстве сохраняет исходный порядок. */
export function searchItems<T>(items: readonly T[], query: string, text: (item: T) => string): T[] {
  if (normalizeText(query) === '') return [...items]
  return items
    .map((item, i) => ({ item, i, score: searchScore(query, text(item)) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .map((x) => x.item)
}

/** Совпадение названий с точностью до регистра, «ё» и пунктуации. */
export function sameName(a: string, b: string): boolean {
  return normalizeText(a) === normalizeText(b)
}
