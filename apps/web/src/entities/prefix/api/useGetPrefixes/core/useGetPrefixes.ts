import { useQuery } from '@tanstack/react-query'

import { fetchData } from '@shared/functions/api/fetchData'

import type { IGetPrefixesResponse } from '../types/IGetPrefixesResponse'

const getPrefixes = (signal?: AbortSignal): Promise<IGetPrefixesResponse> => {
  return fetchData<IGetPrefixesResponse>({ path: '/prefixes', signal })
}

const useGetPrefixes = () => {
  return useQuery({
    queryFn: ({ signal }) => {
      return getPrefixes(signal)
    },
    queryKey: ['prefixes'],
  })
}

export { useGetPrefixes }
