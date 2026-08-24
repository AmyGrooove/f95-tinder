import type { MouseEventHandler, ReactNode, Ref } from 'react'
import type { TButtonSize } from './TButtonSize'
import type { TButtonVariant } from './TButtonVariant'

interface IButtonProps {
  children: ReactNode

  className?: string
  isDisabled?: boolean
  isLoading?: boolean
  onClick?: MouseEventHandler<HTMLButtonElement>
  ref?: Ref<HTMLElement>
  size?: TButtonSize
  variant?: TButtonVariant
}

export type { IButtonProps }
