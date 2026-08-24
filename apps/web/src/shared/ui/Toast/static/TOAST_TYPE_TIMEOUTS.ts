import type { TToastType } from '../types/TToastType'

const TOAST_TYPE_TIMEOUTS: Record<TToastType, number> = {
  error: 30000,
  info: 5000,
  loading: 30000,
  success: 3000,
  warning: 8000,
}

export { TOAST_TYPE_TIMEOUTS }
