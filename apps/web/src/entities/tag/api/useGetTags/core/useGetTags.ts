import { useQuery } from '@tanstack/react-query'

import { fetchData } from '@shared/functions/api/fetchData'

import type { IGetTagsResponse } from '../types/IGetTagsResponse'

const getTags = (signal?: AbortSignal): Promise<IGetTagsResponse> => {
  return fetchData<IGetTagsResponse>({ path: '/tags', signal })
}

const useGetTags = () => {
  return useQuery({
    queryFn: ({ signal }) => {
      return getTags(signal)
    },
    queryKey: ['tags'],
  })
}

export { useGetTags }
