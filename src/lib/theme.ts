export type Theme = 'light' | 'dark' | 'amoled'

export const THEMES: { value: Theme; label: string }[] = [
  { value: 'light', label: 'Светлая' },
  { value: 'dark', label: 'Тёмная' },
  { value: 'amoled', label: 'AMOLED' },
]

const KEY = 'theme'

// цвет статус-бара под каждую тему
const THEME_COLOR: Record<Theme, string> = {
  light: '#f5f5f7',
  dark: '#16161a',
  amoled: '#000000',
}

export function getStoredTheme(): Theme {
  const t = localStorage.getItem(KEY)
  return t === 'dark' || t === 'amoled' || t === 'light' ? t : 'light'
}

export function applyTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme)
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', THEME_COLOR[theme])
}

export function setTheme(theme: Theme) {
  localStorage.setItem(KEY, theme)
  applyTheme(theme)
}
