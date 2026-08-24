import { QueryClientProvider } from '@tanstack/react-query'

import { useQueryProvider } from './useQueryProvider'
import type { IQueryProviderProps } from '../types/IQueryProviderProps'

const QueryProvider = (props: IQueryProviderProps) => {
  const { children, queryClient } = useQueryProvider(props)

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

export { QueryProvider }
