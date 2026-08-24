import type { Ref } from 'react'
import type { IRadioGroupOption } from './IRadioGroupOption'

interface IRadioGroupProps {
  onChange: (value: string) => void
  options: IRadioGroupOption[]
  value: string

  className?: string
  hintText?: string
  isDisabled?: boolean
  label?: string
  ref?: Ref<HTMLDivElement>
}

export type { IRadioGroupProps }
