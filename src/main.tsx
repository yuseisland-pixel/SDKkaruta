import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import './index.css'
import App from './App'
import { ServicesProvider } from './app/ServicesContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ServicesProvider>
      <HashRouter>
        <App />
      </HashRouter>
    </ServicesProvider>
  </StrictMode>,
)
