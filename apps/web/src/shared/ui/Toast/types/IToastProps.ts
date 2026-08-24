import type { TToastType } from './TToastType'
import type { IToastAction } from './IToastAction'

interface IToastProps {
  title: string

  description?: string
  id?: string
  type?: TToastType
  action?: IToastAction
}

export type { IToastProps }
