import { TOAST_MANAGER } from '../../../static/TOAST_MANAGER'
import { TOAST_TYPE_TIMEOUTS } from '../../../static/TOAST_TYPE_TIMEOUTS'
import type { IUpdateToastProps } from '../types/IUpdateToastProps'

const updateToast = (props: IUpdateToastProps) => {
  const { toastId, action, description, title, type } = props

  const toastData = action
    ? { label: action.label, onClick: action.onClick }
    : undefined

  TOAST_MANAGER.update(toastId, {
    data: toastData,
    description,
    title,
    timeout: TOAST_TYPE_TIMEOUTS[type ?? 'info'],
    type,
  })
}

export { updateToast }
