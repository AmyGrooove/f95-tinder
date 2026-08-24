import type { ISwitchProps } from '../types/ISwitchProps'

const useSwitch = (props: ISwitchProps) => {
  const {
    className,
    hintText,
    isDisabled = false,
    label,
    onChange,
    ref,
    value,
  } = props

  const handleChange = (isChecked: boolean) => {
    onChange(isChecked)
  }

  return {
    className,
    handleChange,
    hintText,
    isDisabled,
    label,
    ref,
    value,
  }
}

export { useSwitch }
