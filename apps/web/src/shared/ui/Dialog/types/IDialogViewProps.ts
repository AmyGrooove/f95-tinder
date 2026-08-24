import type { ReactNode } from 'react'

interface IDialogViewProps {
  content: ReactNode
  isOpen: boolean
  title: ReactNode
  onOpenChange: (isOpen: boolean) => void
  onOpenChangeComplete: (isOpen: boolean) => void
}

export type { IDialogViewProps }
