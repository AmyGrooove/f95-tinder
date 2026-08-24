import type { TIconName } from '@shared/ui/Icon'

interface ITabItem {
  value: string
  label: string

  icon?: TIconName
  isDisabled?: boolean
}

export type { ITabItem }
