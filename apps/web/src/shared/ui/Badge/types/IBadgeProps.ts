import type { useRender } from '@base-ui/react/use-render'
import type { ReactNode, Ref } from 'react'
import type { TBadgeSize } from './TBadgeSize'
import type { TBadgeVariant } from './TBadgeVariant'

interface IBadgeProps {
  children: ReactNode

  className?: string
  ref?: Ref<HTMLElement>
  render?: useRender.ComponentProps<'span'>['render']
  size?: TBadgeSize
  variant?: TBadgeVariant
}

export type { IBadgeProps }
