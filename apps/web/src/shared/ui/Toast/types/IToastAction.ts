import type { MouseEventHandler } from 'react'

interface IToastAction {
  label?: string
  onClick?: MouseEventHandler<HTMLButtonElement>
}

export type { IToastAction }
