import { useEffect } from 'react'
import { isNil } from '@shared/functions/checks/isNil'
import type { ISelectProps } from '../types/ISelectProps'

const useSelect = (props: ISelectProps) => {
  const {
    className,
    errorText,
    hintText,
    icon,
    isDisabled = false,
    isRequired = false,
    label,
    onChange,
    options,
    placeholder,
    ref,
    value,
  } = props

  const isError = !isNil(errorText)
  const messageText = errorText ?? hintText
  const isClearButtonVisible = !isRequired && !isNil(value)

  useEffect(() => {
    if (!isRequired || !isNil(value)) {
      return
    }

    const firstEnabledOption = options.find(
      (option) => isNil(option.isDisabled) || !option.isDisabled,
    )

    if (!isNil(firstEnabledOption)) {
      onChange(firstEnabledOption.value)
    }
  }, [isRequired, onChange, options, value])

  const handleChange = (nextValue: string | null) => {
    if (isNil(nextValue)) {
      return
    }

    onChange(nextValue)
  }

  const handleClear = () => {
    onChange(null)
  }

  return {
    className,
    handleChange,
    handleClear,
    icon,
    isClearButtonVisible,
    isDisabled,
    isError,
    label,
    messageText,
    options,
    placeholder,
    ref,
    value,
  }
}

export { useSelect }
