import type { FocusEventHandler, Ref } from 'react'
import type { TIconName } from '@shared/ui/Icon'
import type { TInputType } from './TInputType'

interface IInputProps {
  onChange: (value: string) => void
  value: string

  className?: string
  errorText?: string
  hintText?: string
  icon?: TIconName
  isDisabled?: boolean
  label?: string
  onBlur?: FocusEventHandler<HTMLInputElement>
  onFocus?: FocusEventHandler<HTMLInputElement>
  placeholder?: string
  ref?: Ref<HTMLElement>
  type?: TInputType
}

export type { IInputProps }
