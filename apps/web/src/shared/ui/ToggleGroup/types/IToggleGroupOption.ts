import type { TIconName } from '@shared/ui/Icon'

interface IToggleGroupOption {
  value: string
  label: string

  icon?: TIconName
  isDisabled?: boolean
}

export type { IToggleGroupOption }
