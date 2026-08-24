import { Toast as ToastPrimitive } from '@base-ui/react/toast'
import type { IToastAction } from '../types/IToastAction'

const TOAST_MANAGER = ToastPrimitive.createToastManager<IToastAction>()

export { TOAST_MANAGER }
