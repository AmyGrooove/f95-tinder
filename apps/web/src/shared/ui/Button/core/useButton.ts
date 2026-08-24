import { isValidElement } from 'react'
import { Icon } from '@shared/ui/Icon'
import type { IButtonProps } from '../types/IButtonProps'

const useButton = (props: IButtonProps) => {
  const {
    children,
    className,
    isDisabled = false,
    isLoading = false,
    onClick,
    ref,
    size = 'medium',
    variant = 'primary',
  } = props

  const isIconOnly = isValidElement(children) && children.type === Icon

  return {
    children,
    className,
    isDisabled,
    isIconOnly,
    isLoading,
    onClick,
    ref,
    size,
    variant,
  }
}

export { useButton }
