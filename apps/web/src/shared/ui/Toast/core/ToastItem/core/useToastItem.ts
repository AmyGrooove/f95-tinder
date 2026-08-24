import { TOAST_TYPE_ICON_NAMES } from '../static/TOAST_TYPE_ICON_NAMES'
import type { IToastItemProps } from '../types/IToastItemProps'

const useToastItem = (props: IToastItemProps) => {
  const { toast } = props

  const actionLabel = toast.data?.label
  const iconName = TOAST_TYPE_ICON_NAMES[toast.type ?? '']
  const onAction = toast.data?.onClick

  return {
    actionLabel,
    iconName,
    onAction,
    toast,
  }
}

export { useToastItem }
