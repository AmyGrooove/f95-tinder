import { useMutation } from '@tanstack/react-query'

import { setAccessToken } from '@entities/auth/stores/accessToken'
import { REFRESH_TOKEN_STORAGE_KEY } from '@entities/auth/static/REFRESH_TOKEN_STORAGE_KEY'
import { fetchData } from '@shared/functions/api/fetchData'

import type { ILogoutPayload } from '../types/ILogoutPayload'

const logout = (payload: ILogoutPayload): Promise<void> => {
  return fetchData<void>({
    body: payload,
    method: 'POST',
    path: '/auth/logout',
  })
}

const useLogout = () => {
  return useMutation({
    mutationFn: logout,
    onSuccess: () => {
      localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY)
      setAccessToken(null)
    },
  })
}

export { useLogout }
