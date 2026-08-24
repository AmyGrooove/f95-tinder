import { useQuery } from '@tanstack/react-query'

import { fetchData } from '@shared/functions/api/fetchData'

import type { IGetHealthResponse } from '../types/IGetHealthResponse'

const getHealth = (signal?: AbortSignal): Promise<IGetHealthResponse> => {
  return fetchData<IGetHealthResponse>({ path: '/health', signal })
}

const useGetHealth = () => {
  return useQuery({
    queryFn: ({ signal }) => {
      return getHealth(signal)
    },
    queryKey: ['health'],
  })
}

export { useGetHealth }
