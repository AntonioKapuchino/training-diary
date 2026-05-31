import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import { ensureSeed } from './db/db'
import { applyTheme, getStoredTheme } from './lib/theme'
import './styles.css'

applyTheme(getStoredTheme())
ensureSeed()

// Авто-обновление PWA: когда новый service worker берёт управление —
// перезагружаем страницу, чтобы сразу показать свежую версию.
if ('serviceWorker' in navigator) {
  const hadController = !!navigator.serviceWorker.controller
  let refreshing = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing || !hadController) return
    refreshing = true
    window.location.reload()
  })
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>,
)
