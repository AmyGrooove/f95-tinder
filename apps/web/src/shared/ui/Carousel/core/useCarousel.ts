import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FocusEvent } from 'react'
import useEmblaCarousel from 'embla-carousel-react'
import { isNil } from '@shared/functions/checks/isNil'
import { useCarouselAutoScroll } from '../hooks/useCarouselAutoScroll'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'
import type { ICarouselProps } from '../types/ICarouselProps'

const useCarousel = (props: ICarouselProps) => {
  const {
    autoScrollInterval,
    className,
    gap = 12,
    isCentered = false,
    isDraggable = true,
    isLoop = false,
    isNavigationVisible = false,
    items,
  } = props

  const [isHovered, setIsHovered] = useState(false)
  const [isFocusWithin, setIsFocusWithin] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [isPreviousDisabled, setIsPreviousDisabled] = useState(true)
  const [isNextDisabled, setIsNextDisabled] = useState(true)

  const emblaOptions = useMemo<Parameters<typeof useEmblaCarousel>[0]>(() => {
    return {
      align: isCentered ? 'center' : 'start',
      containScroll: isCentered ? false : 'trimSnaps',
      dragFree: false,
      loop: isLoop,
      watchDrag: (currentEmblaApi) => {
        return (
          isDraggable &&
          (currentEmblaApi.canScrollPrev() || currentEmblaApi.canScrollNext())
        )
      },
    }
  }, [isCentered, isDraggable, isLoop])

  const [emblaViewportRef, emblaApi] = useEmblaCarousel(emblaOptions)

  const { isReducedMotion } = usePrefersReducedMotion()
  const { restartAutoScroll } = useCarouselAutoScroll({
    autoScrollInterval,
    emblaApi,
    isDragging,
    isFocusWithin,
    isHovered,
    isNextDisabled,
    isPreviousDisabled,
    isReducedMotion,
  })

  const isCarouselScrollable = !isPreviousDisabled || !isNextDisabled
  const isNavigationAvailable = isNavigationVisible && isCarouselScrollable

  const synchronizeNavigationState = useCallback(() => {
    if (isNil(emblaApi)) {
      return
    }

    setIsPreviousDisabled(!emblaApi.canScrollPrev())
    setIsNextDisabled(!emblaApi.canScrollNext())
  }, [emblaApi])

  const handlePreviousClick = () => {
    emblaApi?.scrollPrev()
  }

  const handleNextClick = () => {
    emblaApi?.scrollNext()
  }

  const handlePointerEnter = () => {
    setIsHovered(true)
  }

  const handlePointerLeave = () => {
    setIsHovered(false)
  }

  const handleFocusIn = () => {
    setIsFocusWithin(true)
  }

  const handleFocusOut = (event: FocusEvent<HTMLElement>) => {
    const isFocusMovingWithinCarousel =
      event.relatedTarget instanceof Node &&
      event.currentTarget.contains(event.relatedTarget)

    if (isFocusMovingWithinCarousel) {
      return
    }

    setIsFocusWithin(false)
  }

  useEffect(() => {
    if (isNil(emblaApi)) {
      return
    }

    const handleSelect = () => {
      synchronizeNavigationState()
      restartAutoScroll()
    }
    const handlePointerDown = () => {
      setIsDragging(true)
    }
    const handlePointerUp = () => {
      setIsDragging(false)
    }

    emblaApi.on('pointerDown', handlePointerDown)
    emblaApi.on('pointerUp', handlePointerUp)
    emblaApi.on('reInit', handleSelect)
    emblaApi.on('select', handleSelect)

    const animationFrameId = window.requestAnimationFrame(() => {
      synchronizeNavigationState()
    })

    return () => {
      window.cancelAnimationFrame(animationFrameId)
      emblaApi.off('pointerDown', handlePointerDown)
      emblaApi.off('pointerUp', handlePointerUp)
      emblaApi.off('reInit', handleSelect)
      emblaApi.off('select', handleSelect)
    }
  }, [emblaApi, restartAutoScroll, synchronizeNavigationState])

  return {
    className,
    emblaViewportRef,
    gap,
    handleFocusIn,
    handleFocusOut,
    handleNextClick,
    handlePointerEnter,
    handlePointerLeave,
    handlePreviousClick,
    isCarouselScrollable,
    isDraggable,
    isNavigationAvailable,
    isNextDisabled,
    isPreviousDisabled,
    items,
  }
}

export { useCarousel }
