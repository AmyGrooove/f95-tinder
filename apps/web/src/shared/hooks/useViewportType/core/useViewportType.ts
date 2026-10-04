import { useCallback, useSyncExternalStore } from 'react'
import { MOBILE_VIEWPORT_MEDIA_QUERY } from '../static/MOBILE_VIEWPORT_MEDIA_QUERY'
import type { TViewportType } from '../types/TViewportType'

const useViewportType = (): TViewportType => {
  const subscribe = useCallback((onChange: () => void) => {
    const mediaQueryList = window.matchMedia(MOBILE_VIEWPORT_MEDIA_QUERY)

    mediaQueryList.addEventListener('change', onChange)

    return () => {
      mediaQueryList.removeEventListener('change', onChange)
    }
  }, [])

  const getSnapshot = (): TViewportType => {
    return window.matchMedia(MOBILE_VIEWPORT_MEDIA_QUERY).matches
      ? 'mobile'
      : 'desktop'
  }

  const getServerSnapshot = (): TViewportType => {
    return 'desktop'
  }

  const viewportType = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  )

  return viewportType
}

export { useViewportType }
