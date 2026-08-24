import type { TIconName } from '@shared/ui/Icon/types/TIconName'

const TOAST_TYPE_ICON_NAMES: Partial<Record<string, TIconName>> = {
  success: 'circleCheck',
  info: 'info',
  warning: 'alertCircle',
  error: 'circleX',
  loading: 'loading',
}

export { TOAST_TYPE_ICON_NAMES }
