import { Toast as ToastPrimitive } from '@base-ui/react/toast'
import type { IToastAction } from '../types/IToastAction'

const useToast = () => {
  const { toasts } = ToastPrimitive.useToastManager<IToastAction>()

  return {
    toasts,
  }
}

export { useToast }
