import { TOAST_MANAGER } from '../../../static/TOAST_MANAGER'

const closeToast: typeof TOAST_MANAGER.close = (toastId) => {
  TOAST_MANAGER.close(toastId)
}

export { closeToast }
