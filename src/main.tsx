import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import { AppCrashBoundary } from './components/AppCrashBoundary'
import { isLauncherBridgeAvailable } from './launcher/runtime'
import './styles.css'

declare global {
  interface Window {
    __hideBootSplash?: () => void
  }
}

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Root element #root not found')
}

const ElectronOnlyNotice = () => (
  <div className="appCrashRoot">
    <div className="appCrashPanel panel">
      <div className="appCrashEyebrow">Electron only</div>
      <h1 className="appCrashTitle">F95 Tinder больше не запускается как обычный сайт</h1>
      <p className="appCrashText">
        Renderer теперь поддерживается только внутри Electron, чтобы сохранить
        launcher bridge, загрузки и локальные JSON-файлы состояния.
      </p>
      <div className="appCrashMessage">
        Для разработки запусти <code>pnpm dev</code>. Для собранной версии:
        <code> pnpm build</code>, затем <code>pnpm start</code>.
      </div>
    </div>
  </div>
)

const BootSplashCleanup = ({ children }: { children: React.ReactNode }) => {
  React.useEffect(() => {
    window.__hideBootSplash?.()
  }, [])

  return <>{children}</>
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <BootSplashCleanup>
      {isLauncherBridgeAvailable() ? (
        <AppCrashBoundary>
          <App />
        </AppCrashBoundary>
      ) : (
        <ElectronOnlyNotice />
      )}
    </BootSplashCleanup>
  </React.StrictMode>,
)
