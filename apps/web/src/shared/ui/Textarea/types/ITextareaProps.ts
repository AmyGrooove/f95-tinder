import type { FocusEventHandler, Ref } from 'react'

interface ITextareaProps {
  onChange: (value: string) => void
  value: string

  className?: string
  errorText?: string
  hintText?: string
  isDisabled?: boolean
  label?: string
  onBlur?: FocusEventHandler<HTMLTextAreaElement>
  onFocus?: FocusEventHandler<HTMLTextAreaElement>
  placeholder?: string
  ref?: Ref<HTMLTextAreaElement>
}

export type { ITextareaProps }
