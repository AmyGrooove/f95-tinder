import { Input } from '../../../core/Input'
import { useNumberInput } from './useNumberInput'
import type { INumberInputProps } from '../types/INumberInputProps'

const NumberInput = (props: INumberInputProps) => {
  const {
    className,
    errorText,
    handleBlur,
    handleChange,
    handleFocus,
    hintText,
    icon,
    inputValue,
    isDisabled,
    label,
    placeholder,
    ref,
  } = useNumberInput(props)

  return (
    <Input
      className={className}
      errorText={errorText}
      hintText={hintText}
      icon={icon}
      isDisabled={isDisabled}
      label={label}
      onBlur={handleBlur}
      onChange={handleChange}
      onFocus={handleFocus}
      placeholder={placeholder}
      ref={ref}
      value={inputValue}
    />
  )
}

export { NumberInput }
