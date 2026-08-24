import { isValidElement } from 'react'
import { Icon } from '@shared/ui/Icon'
import type { IBadgeProps } from '../types/IBadgeProps'

const useBadge = (props: IBadgeProps) => {
  const {
    children,
    className,
    ref,
    render,
    size = 'medium',
    variant = 'primary',
  } = props

  const isIconOnly = isValidElement(children) && children.type === Icon

  return {
    children,
    className,
    isIconOnly,
    ref,
    render,
    size,
    variant,
  }
}

export { useBadge }
