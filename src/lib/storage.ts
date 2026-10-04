/**
 * Просьба к браузеру не вычищать данные при нехватке места. Для приложения,
 * где всё хранится только на устройстве, это главная страховка.
 */
export async function requestPersistence(): Promise<boolean> {
  try {
    if (!('storage' in navigator)) return false
    if (await navigator.storage.persisted()) return true
    return await navigator.storage.persist()
  } catch {
    return false
  }
}

export async function isPersisted(): Promise<boolean | null> {
  try {
    if (!('storage' in navigator)) return null
    return await navigator.storage.persisted()
  } catch {
    return null
  }
}

export async function storageUsage(): Promise<number | null> {
  try {
    if (!('storage' in navigator)) return null
    const est = await navigator.storage.estimate()
    return est.usage ?? null
  } catch {
    return null
  }
}
