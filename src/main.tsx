import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import '@fontsource-variable/nunito'
import '@fontsource-variable/comfortaa'
import { App } from './App'
import './index.css'

registerSW({ immediate: true })

const container = document.getElementById('root')
if (!container) throw new Error('Не найден корневой элемент #root')

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
