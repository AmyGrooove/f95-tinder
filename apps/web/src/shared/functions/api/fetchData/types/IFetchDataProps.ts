import type { TFetchDataQueryValue } from './TFetchDataQueryValue'

interface IFetchDataProps {
  path: string

  body?: unknown
  method?: 'DELETE' | 'GET' | 'PATCH' | 'POST'
  query?: Record<string, TFetchDataQueryValue>
  signal?: AbortSignal
}

export type { IFetchDataProps }
