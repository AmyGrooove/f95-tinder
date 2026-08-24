import type { useRender } from '@base-ui/react/use-render'
import type { ReactNode, Ref } from 'react'

interface IKbdProps {
  children: ReactNode

  className?: string
  ref?: Ref<HTMLElement>
  render?: useRender.ComponentProps<'kbd'>['render']
}

export type { IKbdProps }
