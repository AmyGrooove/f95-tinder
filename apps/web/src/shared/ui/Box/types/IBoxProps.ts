import type { useRender } from '@base-ui/react/use-render'
import type { CSSProperties, ReactNode, Ref } from 'react'
import type { TBoxAlign } from './TBoxAlign'
import type { TBoxDirection } from './TBoxDirection'
import type { TBoxGap } from './TBoxGap'
import type { TBoxJustify } from './TBoxJustify'
import type { TBoxWrap } from './TBoxWrap'

interface IBoxProps {
  children: ReactNode

  ref?: Ref<HTMLElement>
  alignItems?: TBoxAlign
  flexDirection?: TBoxDirection
  gap?: TBoxGap
  justifyContent?: TBoxJustify
  flexWrap?: TBoxWrap
  className?: string
  isFocusable?: boolean
  render?: useRender.ComponentProps<'div'>['render']
  style?: CSSProperties
}

export type { IBoxProps }
