import type { ICheckboxGroupProps } from '../types/ICheckboxGroupProps'

const useCheckboxGroup = (props: ICheckboxGroupProps) => {
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

  const handleCheckedChange = (optionValue: string, IsNextChecked: boolean) => {
    if (IsNextChecked) {
      onChange([...value, optionValue])

      return
    }

    onChange(value.filter((valueItem) => valueItem !== optionValue))
  }

  return {
    className,
    handleCheckedChange,
    hintText,
    isDisabled,
    label,
    options,
    ref,
    value,
  }
}

export { useCheckboxGroup }
