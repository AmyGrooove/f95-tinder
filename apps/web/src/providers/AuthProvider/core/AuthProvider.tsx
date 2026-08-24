import { useEffect, useRef } from 'react'

import { useRefreshSession } from '@entities/auth/api/useRefreshSession'
import { setAccessToken } from '@entities/auth/stores/accessToken'
import { REFRESH_TOKEN_STORAGE_KEY } from '@entities/auth/static/REFRESH_TOKEN_STORAGE_KEY'
import { isNil } from '@shared/functions/checks/isNil'

const AuthProvider = () => {
  const { data: authSession, mutate: refreshSession } = useRefreshSession()

  const isRefreshStartedRef = useRef(false)

  useEffect(() => {
    if (isRefreshStartedRef.current) {
      return
    }

    isRefreshStartedRef.current = true

    const refreshToken = localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY)

    if (isNil(refreshToken)) {
      return
    }

    refreshSession({ refreshToken })
  }, [refreshSession])

  useEffect(() => {
    if (isNil(authSession)) {
      return
    }

    localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, authSession.refreshToken)
    setAccessToken(authSession.accessToken)
  }, [authSession])

  return null
}

export { AuthProvider }
