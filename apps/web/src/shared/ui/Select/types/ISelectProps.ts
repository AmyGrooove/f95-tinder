import type { Ref } from 'react'
import type { ISelectOption } from './ISelectOption'
import type { TIconName } from '@shared/ui/Icon'

interface ISelectProps {
  onChange: (value: string | null) => void
  options: ISelectOption[]
  value: string | null

  icon?: TIconName
  className?: string
  errorText?: string
  hintText?: string
  isDisabled?: boolean
  isRequired?: boolean
  label?: string
  placeholder?: string
  ref?: Ref<HTMLButtonElement>
}

export type { ISelectProps }
