import type { IToastProps } from '../../../types/IToastProps'

interface IUpdateToastProps extends Omit<IToastProps, 'id' | 'title'> {
  toastId: string

  title?: string
}

export type { IUpdateToastProps }
