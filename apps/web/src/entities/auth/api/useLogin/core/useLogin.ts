import { useMutation } from '@tanstack/react-query'

import { setAccessToken } from '@entities/auth/stores/accessToken'
import { REFRESH_TOKEN_STORAGE_KEY } from '@entities/auth/static/REFRESH_TOKEN_STORAGE_KEY'
import { fetchData } from '@shared/functions/api/fetchData'

import type { ILoginPayload } from '../types/ILoginPayload'
import type { ILoginResponse } from '../types/ILoginResponse'

const login = (payload: ILoginPayload): Promise<ILoginResponse> => {
  return fetchData<ILoginResponse>({
    body: payload,
    method: 'POST',
    path: '/auth/login',
  })
}

const useLogin = () => {
  return useMutation({
    mutationFn: login,
    onSuccess: (authSession) => {
      localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, authSession.refreshToken)
      setAccessToken(authSession.accessToken)
    },
  })
}

export { useLogin }
