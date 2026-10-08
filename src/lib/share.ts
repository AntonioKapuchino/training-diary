/**
 * shared — файл ушёл через меню «Поделиться»; downloaded — меню нет, обычное скачивание;
 * fallback — меню было, но не открылось, файл скачан запасным путём (сохранился ли — неизвестно).
 */
export type ShareResult = 'shared' | 'downloaded' | 'fallback' | 'cancelled'

/**
 * На iPhone — системное меню «Поделиться»: «Сохранить в Файлы», AirDrop, мессенджеры.
 * Где его нет — обычное скачивание.
 */
export async function shareOrDownload(file: File): Promise<ShareResult> {
  let shareFailed = false
  if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: file.name })
      return 'shared'
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled'
      // NotAllowedError и прочее — скачиваем.
      shareFailed = true
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
  return shareFailed ? 'fallback' : 'downloaded'
}

/** Сохранение резервной копии: отметить только то, что точно сохранено. */
export function backupSavedMessage(res: ShareResult): { saved: boolean; message: string } | null {
  if (res === 'cancelled') return null
  if (res === 'fallback')
    return {
      saved: false,
      message: 'Меню «Поделиться» не открылось — файл скачан. Проверь, что он сохранился',
    }
  return { saved: true, message: 'Резервная копия сохранена' }
}

/** Чтение выбранного файла как текста. */
export function readFileText(file: File): Promise<string> {
  return file.text()
}
