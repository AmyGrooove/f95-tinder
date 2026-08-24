import type { ReactNode } from 'react'

interface ICollapsibleProps {
  children: ReactNode
  isOpen: boolean

  className?: string
}

export type { ICollapsibleProps }
