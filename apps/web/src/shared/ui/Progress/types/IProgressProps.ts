import type { Ref } from 'react'

interface IProgressProps {
  value?: number | null
  className?: string
  errorText?: string
  hintText?: string
  label?: string
  max?: number
  ref?: Ref<HTMLDivElement>
}

export type { IProgressProps }
