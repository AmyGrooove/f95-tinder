import type { DefaultOptions } from '@tanstack/react-query'

import { MINUTE_MS } from './MINUTE_MS'

const QUERY_DEFAULT_OPTIONS: DefaultOptions = {
  queries: {
    gcTime: MINUTE_MS * 10,
    retry: 1,
    staleTime: MINUTE_MS,
  },
  mutations: {
    retry: 0,
  },
}

export { QUERY_DEFAULT_OPTIONS }
