import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import { AppCrashBoundary } from './components/AppCrashBoundary'
import './styles.css'

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Root element #root not found')
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <AppCrashBoundary>
      <App />
    </AppCrashBoundary>
  </React.StrictMode>,
)
