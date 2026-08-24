import { isEmptyString } from '@shared/functions/checks/isEmptyString'
import { isNil } from '@shared/functions/checks/isNil'
import type { IProgressProps } from '../types/IProgressProps'

const useProgress = (props: IProgressProps) => {
  const {
    className,
    errorText,
    hintText,
    label,
    max = 100,
    ref,
    value = null,
  } = props

  const isValidMax = Number.isFinite(max) && max > 0
  const normalizedMax = isValidMax ? max : 100
  const isValidValue = !isNil(value) && Number.isFinite(value)
  const normalizedValue = isNil(value)
    ? null
    : isValidValue
      ? Math.min(Math.max(value, 0), normalizedMax)
      : 0
  const isError = !isNil(errorText) && !isEmptyString(errorText)
  const message = isError ? errorText : hintText
  const isMessageVisible = !isNil(message) && !isEmptyString(message)

  return {
    className,
    isError,
    isMessageVisible,
    label,
    max: normalizedMax,
    message,
    ref,
    value: normalizedValue,
  }
}

export { useProgress }
