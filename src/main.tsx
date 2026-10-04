import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from '@/app/App'
import { initAppearance } from '@/settings/settings'
import '@/styles/index.css'

initAppearance()

const root = document.getElementById('root')
if (!root) throw new Error('Нет корневого элемента #root')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
