import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import { ensureSeed } from './db/db'
import { applyTheme, getStoredTheme } from './lib/theme'
import './styles.css'

applyTheme(getStoredTheme())
ensureSeed()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>,
)
