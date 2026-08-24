import type { UseEmblaCarouselType } from 'embla-carousel-react'

interface IUseCarouselAutoScrollProps {
  emblaApi: UseEmblaCarouselType[1]
  isDragging: boolean
  isFocusWithin: boolean
  isHovered: boolean
  isNextDisabled: boolean
  isPreviousDisabled: boolean
  isReducedMotion: boolean

  autoScrollInterval?: number
}

export type { IUseCarouselAutoScrollProps }
