import { SINGLE_TOGGLE_VALUE } from '../static/SINGLE_TOGGLE_VALUE'
import type { ISingleToggleProps } from '../types/ISingleToggleProps'

const useSingleToggle = (props: ISingleToggleProps) => {
  const { className, hintText, icon, isDisabled, label, onChange, ref, value } =
    props

  const options = [{ icon, label, value: SINGLE_TOGGLE_VALUE }]
  const toggleGroupValue = value ? [SINGLE_TOGGLE_VALUE] : []

  const handleChange = (nextValue: string[]) => {
    onChange(nextValue.includes(SINGLE_TOGGLE_VALUE))
  }

  return {
    className,
    handleChange,
    hintText,
    isDisabled,
    options,
    ref,
    toggleGroupValue,
  }
}

export { useSingleToggle }
