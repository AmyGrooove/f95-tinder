import type { ReactElement } from 'react'
import type { TCarouselGap } from './TCarouselGap'

interface ICarouselProps {
  items: ReactElement[]

  autoScrollInterval?: number
  className?: string
  gap?: TCarouselGap
  isCentered?: boolean
  isDraggable?: boolean
  isLoop?: boolean
  isNavigationVisible?: boolean
}

export type { ICarouselProps }
