import type { Ref } from 'react'

interface ISwitchProps {
  isChecked: boolean
  onChange: (isChecked: boolean) => void
  label: string

  className?: string
  hintText?: string
  isDisabled?: boolean
  ref?: Ref<HTMLElement>
}

export type { ISwitchProps }
