import { useQuery } from '@tanstack/react-query'

import { fetchData } from '@shared/functions/api/fetchData'

import type { IGetCreatorsResponse } from '../types/IGetCreatorsResponse'

const getCreators = (signal?: AbortSignal): Promise<IGetCreatorsResponse> => {
  return fetchData<IGetCreatorsResponse>({ path: '/creators', signal })
}

const useGetCreators = () => {
  return useQuery({
    queryFn: ({ signal }) => {
      return getCreators(signal)
    },
    queryKey: ['creators'],
  })
}

export { useGetCreators }
