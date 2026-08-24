import { Button } from '@shared/ui/Button'
import { Icon } from '@shared/ui/Icon'
import { cn } from '@shared/functions/utility/cn'
import { useCarousel } from './useCarousel'
import st from './Carousel.module.scss'
import type { ICarouselProps } from '../types/ICarouselProps'

const Carousel = (props: ICarouselProps) => {
  const {
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
  } = useCarousel(props)

  return (
    <section
      className={cn(st.root, className, st[`root_gap_${gap}`], {
        [st.root_draggable]: isDraggable && isCarouselScrollable,
      })}
      onFocus={handleFocusIn}
      onBlur={handleFocusOut}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
    >
      <div className={cn(st.viewport)} ref={emblaViewportRef}>
        <div className={cn(st.track)}>
          {items.map((carouselItem, index) => {
            return (
              <div className={st.slide} key={carouselItem.key ?? index}>
                {carouselItem}
              </div>
            )
          })}
        </div>
      </div>
      {isNavigationAvailable && (
        <div className={cn(st.navigation, st.previousNavigation)}>
          <Button
            isDisabled={isPreviousDisabled}
            onClick={handlePreviousClick}
            size="medium"
            variant="secondary"
          >
            <Icon name="chevronLeft" />
          </Button>
        </div>
      )}
      {isNavigationAvailable && (
        <div className={cn(st.navigation, st.nextNavigation)}>
          <Button
            isDisabled={isNextDisabled}
            onClick={handleNextClick}
            size="medium"
            variant="secondary"
          >
            <Icon name="chevronRight" />
          </Button>
        </div>
      )}
    </section>
  )
}

export { Carousel }
