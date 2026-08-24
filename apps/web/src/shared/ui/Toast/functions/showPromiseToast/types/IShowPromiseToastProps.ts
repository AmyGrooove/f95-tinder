import type { IToastProps } from '../../../types/IToastProps'

interface IShowPromiseToastProps<T> {
  error: IToastProps | ((error: unknown) => IToastProps)
  loading: IToastProps
  promise: Promise<T>
  success: IToastProps | ((result: T) => IToastProps)
}

export type { IShowPromiseToastProps }
