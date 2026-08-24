import type { IRadioGroupProps } from '../types/IRadioGroupProps'

const useRadioGroup = (props: IRadioGroupProps) => {
  const {
    className,
    hintText,
    isDisabled = false,
    label,
    onChange,
    options,
    ref,
    value,
  } = props

  const handleValueChange = (nextValue: string) => {
    onChange(nextValue)
  }

  return {
    className,
    handleValueChange,
    hintText,
    isDisabled,
    label,
    options,
    ref,
    value,
  }
}

export { useRadioGroup }
