/**
 * Лёгкий отклик под пальцем. В Safari нет Vibration API, но с iOS 18 нажатие на
 * системный переключатель `<input type="checkbox" switch>` даёт тактильный щелчок —
 * этим и пользуемся. На Android — обычная вибрация.
 * Вызывать только из обработчика касания: иначе браузер проигнорирует.
 */
let label: HTMLLabelElement | null = null

function switchLabel(): HTMLLabelElement {
  if (label?.isConnected) return label
  label = document.createElement('label')
  label.setAttribute('aria-hidden', 'true')
  label.style.cssText =
    'position:fixed;left:-100px;top:-100px;width:1px;height:1px;opacity:0;pointer-events:none'
  const input = document.createElement('input')
  input.type = 'checkbox'
  input.setAttribute('switch', '')
  input.tabIndex = -1
  label.append(input)
  document.body.append(label)
  return label
}

const isIOS = () =>
  typeof navigator !== 'undefined' &&
  (/iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))

export function haptic(): void {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator && !isIOS()) {
      navigator.vibrate(8)
      return
    }
    if (isIOS()) {
      // WebKit переводит фокус на переключатель — возвращаем, иначе собьётся ввод и прокрутка.
      const prev = document.activeElement
      switchLabel().click()
      if (prev instanceof HTMLElement && prev !== document.activeElement) {
        prev.focus({ preventScroll: true })
      }
    }
  } catch {
    // Отклик — украшение; если не вышло, молча продолжаем.
  }
}
