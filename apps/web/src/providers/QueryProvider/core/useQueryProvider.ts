import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { QUERY_DEFAULT_OPTIONS } from '../static/QUERY_DEFAULT_OPTIONS'
import type { IQueryProviderProps } from '../types/IQueryProviderProps'

const useQueryProvider = (props: IQueryProviderProps) => {
  const { children } = props

  const [queryClient] = useState(() => {
    return new QueryClient({
      defaultOptions: QUERY_DEFAULT_OPTIONS,
      mutationCache: new MutationCache({
        onError: (error) => {
          console.error('React Query mutation error', error)
        },
      }),
      queryCache: new QueryCache({
        onError: (error) => {
          console.error('React Query query error', error)
        },
      }),
    })
  })

  return {
    queryClient,
    children,
  }
}

export { useQueryProvider }
