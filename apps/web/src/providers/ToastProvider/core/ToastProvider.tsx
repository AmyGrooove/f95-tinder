import { Toast as ToastPrimitive } from '@base-ui/react/toast'
import { Toast } from '@shared/ui/Toast'
import { TOAST_MANAGER } from '@shared/ui/Toast/static/TOAST_MANAGER'
import { useToastProvider } from './useToastProvider'
import type { IToastProviderProps } from '../types/IToastProviderProps'

const ToastProvider = (props: IToastProviderProps) => {
  const { children } = useToastProvider(props)

  return (
    <ToastPrimitive.Provider
      limit={3}
      timeout={5000}
      toastManager={TOAST_MANAGER}
    >
      {children}
      <Toast />
    </ToastPrimitive.Provider>
  )
}

export { ToastProvider }
