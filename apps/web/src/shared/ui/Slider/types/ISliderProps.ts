import type { Ref } from 'react'

interface ISliderProps {
  onChange: (value: number) => void
  value: number

  className?: string
  isDisabled?: boolean
  step?: number
  max?: number
  min?: number
  ref?: Ref<HTMLDivElement>
  label?: string
  hintText?: string
  errorText?: string
}

export type { ISliderProps }
