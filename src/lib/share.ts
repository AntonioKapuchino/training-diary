export type ShareResult = 'shared' | 'downloaded' | 'cancelled'

/**
 * На iPhone — системное меню «Поделиться»: «Сохранить в Файлы», AirDrop, мессенджеры.
 * Где его нет — обычное скачивание.
 */
export async function shareOrDownload(file: File): Promise<ShareResult> {
  if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: file.name })
      return 'shared'
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled'
      // NotAllowedError и прочее — скачиваем.
    }
  }
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = file.name
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => {
    URL.revokeObjectURL(url)
  }, 10_000)
  return 'downloaded'
}

/** Чтение выбранного файла как текста. */
export function readFileText(file: File): Promise<string> {
  return file.text()
}
