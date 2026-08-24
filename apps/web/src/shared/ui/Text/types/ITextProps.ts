import type { useRender } from '@base-ui/react/use-render'
import type { ReactNode, Ref } from 'react'
import type { TTextFontSize } from './TTextFontSize'
import type { TTextWeight } from './TTextWeight'

interface ITextProps {
  children: ReactNode

  className?: string
  fontSize?: TTextFontSize
  maxLines?: number
  ref?: Ref<HTMLElement>
  render?: useRender.ComponentProps<'div'>['render']
  weight?: TTextWeight
}

export type { ITextProps }
