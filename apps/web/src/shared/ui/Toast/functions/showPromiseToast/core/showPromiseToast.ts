import { TOAST_MANAGER } from '../../../static/TOAST_MANAGER'
import { getToastUpdateOptions } from '../functions/getToastUpdateOptions'
import type { IShowPromiseToastProps } from '../types/IShowPromiseToastProps'

const showPromiseToast = <T>(props: IShowPromiseToastProps<T>) => {
  const { error, loading, promise, success } = props

  const errorOptions =
    typeof error === 'function'
      ? (errorValue: unknown) => {
          return getToastUpdateOptions(error(errorValue))
        }
      : getToastUpdateOptions(error)

  const successOptions =
    typeof success === 'function'
      ? (result: T) => {
          return getToastUpdateOptions(success(result))
        }
      : getToastUpdateOptions(success)

  return TOAST_MANAGER.promise(promise, {
    error: errorOptions,
    loading: getToastUpdateOptions(loading),
    success: successOptions,
  })
}

export { showPromiseToast }
