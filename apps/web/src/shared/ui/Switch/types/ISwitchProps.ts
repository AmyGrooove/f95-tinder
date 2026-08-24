import type { Ref } from 'react'

interface ISwitchProps {
  value: boolean
  onChange: (isChecked: boolean) => void
  label: string

  className?: string
  hintText?: string
  isDisabled?: boolean
  ref?: Ref<HTMLElement>
}

export type { ISwitchProps }
