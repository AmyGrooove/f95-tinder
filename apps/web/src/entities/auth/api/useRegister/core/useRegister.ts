import { useMutation } from '@tanstack/react-query'

import { setAccessToken } from '@entities/auth/stores/accessToken'
import { REFRESH_TOKEN_STORAGE_KEY } from '@entities/auth/static/REFRESH_TOKEN_STORAGE_KEY'
import { fetchData } from '@shared/functions/api/fetchData'

import type { IRegisterPayload } from '../types/IRegisterPayload'
import type { IRegisterResponse } from '../types/IRegisterResponse'

const register = (payload: IRegisterPayload): Promise<IRegisterResponse> => {
  return fetchData<IRegisterResponse>({
    body: payload,
    method: 'POST',
    path: '/auth/register',
  })
}

const useRegister = () => {
  return useMutation({
    mutationFn: register,
    onSuccess: (authSession) => {
      localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, authSession.refreshToken)
      setAccessToken(authSession.accessToken)
    },
  })
}

export { useRegister }
