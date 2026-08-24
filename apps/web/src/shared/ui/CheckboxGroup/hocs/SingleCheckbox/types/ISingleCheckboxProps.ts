import type { ICheckboxGroupProps } from '../../../types/ICheckboxGroupProps'

interface ISingleCheckboxProps extends Omit<
  ICheckboxGroupProps,
  'onChange' | 'options' | 'value' | 'label'
> {
  onChange: (isChecked: boolean) => void
  value: boolean
  label: string
}

export type { ISingleCheckboxProps }
