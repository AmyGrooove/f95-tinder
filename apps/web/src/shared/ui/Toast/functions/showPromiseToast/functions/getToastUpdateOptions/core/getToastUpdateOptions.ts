import { isNil } from '@shared/functions/checks/isNil'
import { TOAST_TYPE_TIMEOUTS } from '../../../../../static/TOAST_TYPE_TIMEOUTS'
import type { IToastProps } from '../../../../../types/IToastProps'

const getToastUpdateOptions = (props: IToastProps) => {
  const { action, description, title, type } = props

  const toastData = !isNil(action)
    ? { label: action.label, onClick: action.onClick }
    : undefined

  return {
    data: toastData,
    description,
    title,
    timeout: TOAST_TYPE_TIMEOUTS[type ?? 'info'],
    type,
  }
}

export { getToastUpdateOptions }
