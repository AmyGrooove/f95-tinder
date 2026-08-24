import type { Ref } from 'react'
import type { ICheckboxGroupOption } from './ICheckboxGroupOption'

interface ICheckboxGroupProps {
  onChange: (value: string[]) => void
  options: ICheckboxGroupOption[]
  value: string[]

  className?: string
  hintText?: string
  isDisabled?: boolean
  label?: string
  ref?: Ref<HTMLDivElement>
}

export type { ICheckboxGroupProps }
