import type { ReactElement, ReactNode } from 'react'
import type { TDropdownAlign } from './TDropdownAlign'
import type { TDropdownSide } from './TDropdownSide'

interface IDropdownProps {
  children: ReactElement
  content: ReactNode

  align?: TDropdownAlign
  className?: string
  isDisabled?: boolean
  isOpen?: boolean
  onOpenChange?: (isOpen: boolean) => void
  side?: TDropdownSide
}

export type { IDropdownProps }
