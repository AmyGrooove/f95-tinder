import type { ICheckboxGroupProps } from '../../../types/ICheckboxGroupProps'

interface ISingleCheckboxProps extends Omit<
  ICheckboxGroupProps,
  'onChange' | 'options' | 'value' | 'label'
> {
  onChange: (isChecked: boolean) => void
  isChecked: boolean
  label: string
}

export type { ISingleCheckboxProps }
