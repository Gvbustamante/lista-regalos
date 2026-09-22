import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import './index.css'

registerSW({ immediate: true })

// Evita que el navegador borre la base local por falta de espacio
void navigator.storage?.persist?.()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
