import type { ReactElement, ReactNode } from 'react'
import type { TTooltipAlign } from './TTooltipAlign'
import type { TTooltipSide } from './TTooltipSide'

interface ITooltipProps {
  children: ReactElement
  content: ReactNode

  align?: TTooltipAlign
  className?: string
  isDisabled?: boolean
  side?: TTooltipSide
}

export type { ITooltipProps }
