import { isNil } from '@shared/functions/checks/isNil'
import type { IInputProps } from '../types/IInputProps'

const useInput = (props: IInputProps) => {
  const {
    className,
    errorText,
    hintText,
    icon,
    isDisabled = false,
    label,
    onBlur,
    onChange,
    onFocus,
    placeholder,
    ref,
    type = 'text',
    value,
  } = props

  const isError = !isNil(errorText)
  const messageText = errorText ?? hintText

  const handleChange = (nextValue: string) => {
    onChange(nextValue)
  }

  return {
    className,
    handleChange,
    icon,
    isDisabled,
    isError,
    label,
    messageText,
    onBlur,
    onFocus,
    placeholder,
    ref,
    type,
    value,
  }
}

export { useInput }
