import type { TIconName } from '@shared/ui/Icon'
import type { IToggleGroupProps } from '../../../types/IToggleGroupProps'

interface ISingleToggleProps extends Omit<
  IToggleGroupProps,
  'onChange' | 'options' | 'value' | 'label'
> {
  onChange: (isPressed: boolean) => void
  isPressed: boolean
  label: string

  icon?: TIconName
}

export type { ISingleToggleProps }
