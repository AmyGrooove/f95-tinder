interface IFetchDataProps {
  path: string

  body?: unknown
  method?: 'DELETE' | 'GET' | 'PATCH' | 'POST'
  query?: object
  signal?: AbortSignal
}

export type { IFetchDataProps }
