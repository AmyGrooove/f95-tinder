import { Toast as ToastPrimitive } from '@base-ui/react/toast'
import { ToastItem } from './ToastItem'
import { useToast } from './useToast'
import st from './Toast.module.scss'

const Toast = () => {
  const { toasts } = useToast()

  return (
    <ToastPrimitive.Portal>
      <ToastPrimitive.Viewport className={st.root}>
        {toasts.map((toast) => {
          return <ToastItem key={toast.id} toast={toast} />
        })}
      </ToastPrimitive.Viewport>
    </ToastPrimitive.Portal>
  )
}

export { Toast }
