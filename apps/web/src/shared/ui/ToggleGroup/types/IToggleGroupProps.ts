import type { Ref } from 'react'
import type { IToggleGroupOption } from './IToggleGroupOption'

interface IToggleGroupProps {
  onChange: (value: string[]) => void
  options: IToggleGroupOption[]
  value: string[]

  className?: string
  hintText?: string
  isDisabled?: boolean
  label?: string
  ref?: Ref<HTMLDivElement>
}

export type { IToggleGroupProps }
