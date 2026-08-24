import { isNil } from '@shared/functions/checks/isNil'
import type { ISliderProps } from '../types/ISliderProps'

const useSlider = (props: ISliderProps) => {
  const {
    className,
    errorText,
    hintText,
    isDisabled = false,
    label,
    max = 100,
    min = 0,
    onChange,
    ref,
    step = 1,
    value,
  } = props

  const isError = !isNil(errorText)
  const messageText = errorText ?? hintText

  const handleChange = (nextValue: number) => {
    onChange?.(nextValue)
  }

  return {
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
  }
}

export { useSlider }
