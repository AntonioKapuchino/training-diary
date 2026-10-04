/** Случайный идентификатор записи. Строковые id не конфликтуют при будущей синхронизации. */
export function newId(): string {
  return crypto.randomUUID()
}
