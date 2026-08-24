import { isNil } from '@shared/functions/checks/isNil'
import { TOAST_MANAGER } from '../../../static/TOAST_MANAGER'
import { TOAST_TYPE_TIMEOUTS } from '../../../static/TOAST_TYPE_TIMEOUTS'
import type { IToastProps } from '../../../types/IToastProps'

const showToast = (props: IToastProps) => {
  const { action, description, id, title, type } = props

  const toastData = !isNil(action)
    ? { label: action.label, onClick: action.onClick }
    : undefined

  return TOAST_MANAGER.add({
    data: toastData,
    description,
    id,
    title,
    timeout: TOAST_TYPE_TIMEOUTS[type ?? 'info'],
    type,
  })
}

export { showToast }
