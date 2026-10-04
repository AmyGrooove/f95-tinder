import { ApiError, ERROR_CODES } from '@shared/errors/ApiError'
import { isArray } from '@shared/functions/checks/isArray'
import { isNil } from '@shared/functions/checks/isNil'
import { isObject } from '@shared/functions/checks/isObject'
import { isString } from '@shared/functions/checks/isString'
import { ENV } from '@shared/static/ENV'

import type { IFetchDataProps } from '../types/IFetchDataProps'
import type { IApiErrorResponse } from '@shared/errors/ApiError'

const getApiErrorResponse = async (
  response: Response,
): Promise<IApiErrorResponse> => {
  const fallbackErrorResponse: IApiErrorResponse = {
    code: 'INTERNAL_ERROR',
    details: null,
    message: `Network error: ${response.status}`,
  }

  try {
    const parsedResponse: unknown = await response.json()
    const details = isObject(parsedResponse)
      ? parsedResponse.details
      : undefined
    const errorCode = isObject(parsedResponse)
      ? ERROR_CODES.find((code) => code === parsedResponse.code)
      : undefined

    if (
      !isObject(parsedResponse) ||
      isNil(errorCode) ||
      !isString(parsedResponse.message) ||
      (details !== null && !isObject(details))
    ) {
      return fallbackErrorResponse
    }

    return {
      code: errorCode,
      details,
      message: parsedResponse.message,
    }
  } catch {
    return fallbackErrorResponse
  }
}

const fetchData = async <TResponse>(
  props: IFetchDataProps,
): Promise<TResponse | undefined> => {
  const { body, method = 'GET', path, query, signal } = props

  const searchParameters = new URLSearchParams()

  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (isNil(value)) {
      return
    }

    searchParameters.set(key, isArray(value) ? value.join(',') : String(value))
  })

  const queryString = searchParameters.toString()
  const headers = new Headers()
  const apiUrl = ENV.API_URL?.replace(/\/+$/, '')

  if (isNil(apiUrl) || apiUrl === '') {
    throw new Error('API_URL is not configured')
  }

  if (!isNil(body)) {
    headers.set('Content-Type', 'application/json')
  }

  const response = await fetch(
    `${apiUrl}/v1${path.startsWith('/') ? path : `/${path}`}${
      queryString !== '' ? `?${queryString}` : ''
    }`,
    {
      body: isNil(body) ? undefined : JSON.stringify(body),
      headers,
      method,
      signal,
    },
  )

  if (!response.ok) {
    const errorResponse = await getApiErrorResponse(response)

    throw new ApiError({
      ...errorResponse,
      status: response.status,
    })
  }

  if (response.status === 204) {
    return undefined
  }

  return response.json() as Promise<TResponse>
}

export { fetchData }
