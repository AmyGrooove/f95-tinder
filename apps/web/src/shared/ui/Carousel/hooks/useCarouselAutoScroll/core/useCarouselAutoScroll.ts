import { useCallback, useEffect, useState } from 'react'
import { isNil } from '@shared/functions/checks/isNil'
import type { IUseCarouselAutoScrollProps } from '../types/IUseCarouselAutoScrollProps'

const useCarouselAutoScroll = (props: IUseCarouselAutoScrollProps) => {
  const {
    autoScrollInterval,
    emblaApi,
    isDragging,
    isFocusWithin,
    isHovered,
    isNextDisabled,
    isPreviousDisabled,
    isReducedMotion,
  } = props

  const [autoScrollVersion, setAutoScrollVersion] = useState(0)

  const isCarouselScrollable = !isPreviousDisabled || !isNextDisabled
  const isAutoScrollPaused = isHovered || isFocusWithin || isDragging
  const isAutoScrollEnabled =
    !isNil(autoScrollInterval) &&
    autoScrollInterval > 0 &&
    isCarouselScrollable &&
    !isAutoScrollPaused &&
    !isReducedMotion &&
    !isNextDisabled

  const restartAutoScroll = useCallback(() => {
    setAutoScrollVersion((currentAutoScrollVersion) => {
      return currentAutoScrollVersion + 1
    })
  }, [])

  useEffect(() => {
    if (isNil(emblaApi) || !isAutoScrollEnabled || isNil(autoScrollInterval)) {
      return
    }

    const autoScrollTimeout = window.setTimeout(() => {
      emblaApi.scrollNext()
    }, autoScrollInterval)

    return () => {
      window.clearTimeout(autoScrollTimeout)
    }
  }, [autoScrollInterval, autoScrollVersion, emblaApi, isAutoScrollEnabled])

  return {
    restartAutoScroll,
  }
}

export { useCarouselAutoScroll }
