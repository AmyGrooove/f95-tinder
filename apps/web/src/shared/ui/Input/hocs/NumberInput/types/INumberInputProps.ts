import type { IInputProps } from '../../../types/IInputProps'

interface INumberInputProps extends Omit<
  IInputProps,
  'onChange' | 'type' | 'value'
> {
  onChange: (value: number | null) => void
  value: number | null
}

export type { INumberInputProps }
