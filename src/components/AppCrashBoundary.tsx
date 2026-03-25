import React from 'react'
import { restartLauncherApp } from '../launcher/runtime'

type AppCrashBoundaryProps = {
  children: React.ReactNode
}

type AppCrashBoundaryState = {
  error: Error | null
  details: string | null
}

const formatUnknownError = (value: unknown) => {
  if (value instanceof Error) {
    return value
  }

  if (typeof value === 'string' && value.trim()) {
    return new Error(value)
  }

  try {
    return new Error(JSON.stringify(value))
  } catch {
    return new Error('Неизвестная ошибка приложения')
  }
}

class AppCrashBoundary extends React.Component<
  AppCrashBoundaryProps,
  AppCrashBoundaryState
> {
  state: AppCrashBoundaryState = {
    error: null,
    details: null,
  }

  static getDerivedStateFromError(error: Error): AppCrashBoundaryState {
    return {
      error,
      details: error.stack ?? null,
    }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    const nextDetails = [error.stack, info.componentStack]
      .filter((part) => typeof part === 'string' && part.trim().length > 0)
      .join('\n\n')

    if (nextDetails) {
      this.setState({
        details: nextDetails,
      })
    }

    console.error('Application render error', error, info)
  }

  componentDidMount() {
    window.addEventListener('error', this.handleWindowError)
    window.addEventListener('unhandledrejection', this.handleUnhandledRejection)
  }

  componentWillUnmount() {
    window.removeEventListener('error', this.handleWindowError)
    window.removeEventListener(
      'unhandledrejection',
      this.handleUnhandledRejection,
    )
  }

  handleWindowError = (event: Event) => {
    if (!(event instanceof ErrorEvent)) {
      return
    }

    const error = formatUnknownError(event.error ?? event.message)
    this.setState({
      error,
      details: error.stack ?? event.message ?? null,
    })
    console.error('Unhandled window error', error)
  }

  handleUnhandledRejection = (event: PromiseRejectionEvent) => {
    const error = formatUnknownError(event.reason)
    this.setState({
      error,
      details: error.stack ?? error.message,
    })
    console.error('Unhandled promise rejection', error)
  }

  handleRestartClick = () => {
    void restartLauncherApp()
  }

  handleReloadClick = () => {
    window.location.reload()
  }

  render() {
    if (this.state.error) {
      return (
        <div className="appCrashRoot">
          <div className="appCrashPanel panel">
            <div className="appCrashEyebrow">Приложение остановилось</div>
            <h1 className="appCrashTitle">F95 Tinder столкнулся с ошибкой</h1>
            <p className="appCrashText">
              Интерфейс был аварийно остановлен, чтобы не оставлять пустой экран.
              Перезапусти приложение. Если ошибка повторится, пришли текст из
              технических деталей.
            </p>
            <div className="appCrashMessage">
              {this.state.error.message || 'Неизвестная ошибка приложения'}
            </div>
            <div className="appCrashActions">
              <button
                className="button buttonPrimary"
                onClick={this.handleRestartClick}
                type="button"
              >
                Перезапустить приложение
              </button>
              <button
                className="button"
                onClick={this.handleReloadClick}
                type="button"
              >
                Перезагрузить окно
              </button>
            </div>
            <details className="appCrashDetailsBlock">
              <summary>Технические детали</summary>
              <pre className="appCrashDetails">
                {this.state.details ?? this.state.error.stack ?? this.state.error.message}
              </pre>
            </details>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export { AppCrashBoundary }
