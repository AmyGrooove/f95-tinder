import { useEffect, useState } from 'react'
import { MOBILE_VIEWPORT_MEDIA_QUERY } from '../static/MOBILE_VIEWPORT_MEDIA_QUERY'
import type { TViewportType } from '../types/TViewportType'

const useViewportType = (): TViewportType => {
  const [viewportType, setViewportType] = useState<TViewportType>('desktop')

  useEffect(() => {
    const mediaQueryList = window.matchMedia(MOBILE_VIEWPORT_MEDIA_QUERY)

    const handleMediaQueryChange = () => {
      if (mediaQueryList.matches) {
        setViewportType('mobile')
        return
      }

      setViewportType('desktop')
    }

    handleMediaQueryChange()
    mediaQueryList.addEventListener('change', handleMediaQueryChange)

    return () => {
      mediaQueryList.removeEventListener('change', handleMediaQueryChange)
    }
  }, [])

  return viewportType
}

export { useViewportType }
