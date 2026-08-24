import { Slider as SliderPrimitive } from '@base-ui/react/slider'
import { isNil } from '@shared/functions/checks/isNil'
import { cn } from '@shared/functions/utility/cn'
import { Text } from '@shared/ui/Text'
import { useSlider } from './useSlider'
import st from './Slider.module.scss'
import type { ISliderProps } from '../types/ISliderProps'

const Slider = (props: ISliderProps) => {
  const {
    className,
    isDisabled,
    isError,
    handleChange,
    label,
    max,
    messageText,
    min,
    ref,
    step,
    value,
  } = useSlider(props)

  return (
    <div
      className={cn(st.root, className, {
        [st.root_disabled]: isDisabled,
        [st.root_error]: isError,
      })}
    >
      {!isNil(label) && (
        <Text maxLines={2} weight={700} render={<span />}>
          {label}
        </Text>
      )}
      <SliderPrimitive.Root
        className={st.slider}
        disabled={isDisabled}
        max={max}
        min={min}
        onValueChange={handleChange}
        ref={ref}
        step={step}
        value={value}
      >
        <SliderPrimitive.Control className={st.control}>
          <SliderPrimitive.Track className={st.track}>
            <SliderPrimitive.Indicator className={st.indicator} />
          </SliderPrimitive.Track>
          <SliderPrimitive.Thumb className={st.thumb} />
        </SliderPrimitive.Control>
      </SliderPrimitive.Root>
      {!isNil(messageText) && (
        <Text
          className={st.hintText}
          fontSize={12}
          maxLines={2}
          render={<span />}
        >
          {messageText}
        </Text>
      )}
    </div>
  )
}

export { Slider }
