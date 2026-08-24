import type { IToggleGroupProps } from '../types/IToggleGroupProps'

const useToggleGroup = (props: IToggleGroupProps) => {
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

  const handleValueChange = (nextValue: string[]) => {
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

export { useToggleGroup }
