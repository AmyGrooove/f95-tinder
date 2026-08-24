import { $accessToken } from '@entities/auth/stores/accessToken'
import { isNil } from '@shared/functions/checks/isNil'
import { getResponseErrorMessage } from '@shared/functions/utility/getResponseErrorMessage'
import { API_BASE_PATH } from '@shared/static/API_BASE_PATH'

import type { IFetchDataProps } from '../types/IFetchDataProps'

const fetchData = async <TResponse>(
  props: IFetchDataProps,
): Promise<TResponse> => {
  const { body, method = 'GET', path, query, signal } = props

  const searchParameters = new URLSearchParams()

  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (isNil(value)) {
      return
    }

    searchParameters.set(
      key,
      Array.isArray(value) ? value.join(',') : String(value),
    )
  })

  const queryString = searchParameters.toString()
  const accessToken = $accessToken.getState()
  const headers = new Headers()

  if (!isNil(body)) {
    headers.set('Content-Type', 'application/json')
  }

  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`)
  }

  const response = await fetch(
    `${API_BASE_PATH}/v1${path}${queryString ? `?${queryString}` : ''}`,
    {
      body: isNil(body) ? undefined : JSON.stringify(body),
      headers,
      method,
      signal,
    },
  )

  if (!response.ok) {
    throw new Error(await getResponseErrorMessage(response))
  }

  if (response.status === 204) {
    return undefined as TResponse
  }

  return response.json() as Promise<TResponse>
}

export { fetchData }
