import { SINGLE_CHECKBOX_VALUE } from '../static/SINGLE_CHECKBOX_VALUE'
import type { ISingleCheckboxProps } from '../types/ISingleCheckboxProps'

const useSingleCheckbox = (props: ISingleCheckboxProps) => {
  const { className, hintText, isDisabled, label, onChange, ref, value } = props

  const options = [{ label: label ?? '', value: SINGLE_CHECKBOX_VALUE }]
  const checkboxGroupValue = value ? [SINGLE_CHECKBOX_VALUE] : []

  const handleChange = (nextValue: string[]) => {
    onChange(nextValue.includes(SINGLE_CHECKBOX_VALUE))
  }

  return {
    checkboxGroupValue,
    className,
    handleChange,
    hintText,
    isDisabled,
    options,
    ref,
  }
}

export { useSingleCheckbox }
