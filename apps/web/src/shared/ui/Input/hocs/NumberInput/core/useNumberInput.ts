import { useState } from 'react'
import type { FocusEvent } from 'react'
import { isEmptyString } from '@shared/functions/checks/isEmptyString'
import { isNil } from '@shared/functions/checks/isNil'
import { formatNumberInputValue } from '../functions/formatNumberInputValue'
import type { INumberInputProps } from '../types/INumberInputProps'

const useNumberInput = (props: INumberInputProps) => {
  const {
    className,
    errorText,
    hintText,
    icon,
    isDisabled,
    label,
    onBlur,
    onChange,
    onFocus,
    placeholder,
    ref,
    value,
  } = props

  const [inputValue, setInputValue] = useState(() => {
    return formatNumberInputValue(value)
  })
  const [isFocused, setIsFocused] = useState(false)

  const formattedValue = formatNumberInputValue(value)
  const displayedValue = isFocused ? inputValue : formattedValue

  const handleBlur = (event: FocusEvent<HTMLInputElement>) => {
    const numberValue = isEmptyString(inputValue) ? null : Number(inputValue)

    setIsFocused(false)
    setInputValue(formatNumberInputValue(numberValue))
    onBlur?.(event)
  }

  const handleChange = (nextValue: string) => {
    const normalizedValue = nextValue.replace(/\D/g, '')
    const nextNumberValue = isEmptyString(normalizedValue)
      ? null
      : Number(normalizedValue)

    if (!isNil(nextNumberValue) && !Number.isSafeInteger(nextNumberValue)) {
      return
    }

    setInputValue(normalizedValue)
    onChange(nextNumberValue)
  }

  const handleFocus = (event: FocusEvent<HTMLInputElement>) => {
    setIsFocused(true)
    setInputValue(isNil(value) ? '' : String(value))
    onFocus?.(event)
  }

  return {
    className,
    errorText,
    handleBlur,
    handleChange,
    handleFocus,
    hintText,
    icon,
    inputValue: displayedValue,
    isDisabled,
    label,
    placeholder,
    ref,
  }
}

export { useNumberInput }
