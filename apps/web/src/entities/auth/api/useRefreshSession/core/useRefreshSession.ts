import { useMutation } from '@tanstack/react-query'

import { fetchData } from '@shared/functions/api/fetchData'

import type { IRefreshPayload } from '../types/IRefreshPayload'
import type { IRefreshSessionResponse } from '../types/IRefreshSessionResponse'

const refreshSession = (
  payload: IRefreshPayload,
): Promise<IRefreshSessionResponse> => {
  return fetchData<IRefreshSessionResponse>({
    body: payload,
    method: 'POST',
    path: '/auth/refresh',
  })
}

const useRefreshSession = () => {
  return useMutation({
    mutationFn: refreshSession,
  })
}

export { useRefreshSession }
