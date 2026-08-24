import { useCallback, useLayoutEffect, useRef } from 'react'
import { isNil } from '@shared/functions/checks/isNil'
import { useMergeRefs } from '@shared/hooks/useMergeRefs'
import type { ITextareaProps } from '../types/ITextareaProps'

const useTextarea = (props: ITextareaProps) => {
  const {
    className,
    errorText,
    hintText,
    isDisabled = false,
    label,
    onBlur,
    onChange,
    onFocus,
    placeholder,
    ref,
    value,
  } = props

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const mergedTextareaRef = useMergeRefs(textareaRef, ref)

  const isError = !isNil(errorText)
  const messageText = errorText ?? hintText

  const resizeTextarea = useCallback(() => {
    const textareaElement = textareaRef.current

    if (isNil(textareaElement)) {
      return
    }

    const currentHeight = textareaElement.offsetHeight

    textareaElement.style.height = 'auto'

    const computedStyles = getComputedStyle(textareaElement)
    const minimumHeight = Number.parseFloat(computedStyles.minHeight)
    const maximumHeight = Number.parseFloat(computedStyles.maxHeight)
    const nextHeight = Math.min(
      Math.max(textareaElement.scrollHeight, minimumHeight),
      maximumHeight,
    )

    textareaElement.style.height = `${currentHeight}px`
    textareaElement.getBoundingClientRect()
    textareaElement.style.height = `${nextHeight}px`
    textareaElement.style.overflowY =
      textareaElement.scrollHeight > maximumHeight ? 'auto' : 'hidden'
  }, [])

  const handleValueChange = (nextValue: string) => {
    onChange(nextValue)
  }

  useLayoutEffect(() => {
    resizeTextarea()
  }, [resizeTextarea, value])

  return {
    className,
    handleValueChange,
    isDisabled,
    isError,
    label,
    messageText,
    onBlur,
    onFocus,
    placeholder,
    mergedTextareaRef,
    value,
  }
}

export { useTextarea }
