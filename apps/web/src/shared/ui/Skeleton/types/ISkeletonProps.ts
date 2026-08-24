import type { useRender } from '@base-ui/react/use-render'
import type { Ref } from 'react'

interface ISkeletonProps {
  className?: string
  isFlexShrinkDisabled?: boolean
  ref?: Ref<HTMLElement>
  render?: useRender.ComponentProps<'div'>['render']
}

export type { ISkeletonProps }
