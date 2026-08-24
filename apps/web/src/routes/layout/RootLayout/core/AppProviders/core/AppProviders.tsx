'use client'

import { AuthProvider } from '@providers/AuthProvider'
import { DialogProvider } from '@providers/DialogProvider'
import { QueryProvider } from '@providers/QueryProvider'
import { ToastProvider } from '@providers/ToastProvider'
import { TooltipProvider } from '@providers/TooltipProvider'

import { useAppProviders } from './useAppProviders'

import type { IAppProvidersProps } from '../types/IAppProvidersProps'

const AppProviders = (props: IAppProvidersProps) => {
  const { children } = useAppProviders(props)

  return (
    <TooltipProvider>
      <QueryProvider>
        <AuthProvider />
        <ToastProvider>
          <DialogProvider>{children}</DialogProvider>
        </ToastProvider>
      </QueryProvider>
    </TooltipProvider>
  )
}

export { AppProviders }
