/** Случайный идентификатор записи. Строковые id не конфликтуют при будущей синхронизации. */
export function newId(): string {
  // randomUUID есть только в защищённом контексте (https, localhost). По http с IP-адреса —
  // например, при проверке с телефона по Wi-Fi — его нет, и UUID v4 собирается вручную.
  const randomUUID = (crypto as { randomUUID?: () => string }).randomUUID
  if (typeof randomUUID === 'function') return randomUUID.call(crypto)
  const b = crypto.getRandomValues(new Uint8Array(16))
  b[6] = ((b[6] ?? 0) & 0x0f) | 0x40
  b[8] = ((b[8] ?? 0) & 0x3f) | 0x80
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}
