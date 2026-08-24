import type { ReactNode } from 'react'

interface IDialogState {
  content: ReactNode | null
  isOpen: boolean
  title: ReactNode | null
}

export type { IDialogState }
