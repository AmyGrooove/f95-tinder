import type { F95ApiResponse, F95ThreadItem } from './types'
import { fetchLatestGamesPageViaLauncher } from '../launcher/runtime'

const F95_COOKIE_REFRESH_ERROR_MESSAGE =
  'Не удалось проверить обновления: F95 вернул неожиданный ответ. Похоже, куки устарели или сломались. Обнови их во вкладке Куки.'

const isLikelyCookieRefreshErrorMessage = (
  message: string | null | undefined,
) => {
  if (!message) {
    return false
  }

  const normalizedMessage = message.trim().toLowerCase()
  return (
    normalizedMessage.includes('куки') ||
    normalizedMessage.includes('cookie') ||
    normalizedMessage.includes('unexpected api response shape') ||
    normalizedMessage.includes('not valid json') ||
    normalizedMessage.includes('unexpected token') ||
    normalizedMessage.includes('network error: 401') ||
    normalizedMessage.includes('network error: 403')
  )
}

const buildThreadLink = (threadIdentifier: number) => `https://f95zone.to/threads/${threadIdentifier}`

const buildLatestGamesEndpointUrl = (pageNumber: number) => {
  const searchParameters = new URLSearchParams()

  searchParameters.set('cmd', 'list')
  searchParameters.set('cat', 'games')
  searchParameters.set('page', String(pageNumber))

  searchParameters.append('noprefixes[]', '1')
  searchParameters.append('noprefixes[]', '4')
  searchParameters.append('noprefixes[]', '7')

  searchParameters.append('notags[]', '2265')
  searchParameters.set('sort', 'date')

  searchParameters.set('_', String(Date.now()))

  return `/f95/sam/latest_alpha/latest_data.php?${searchParameters.toString()}`
}

const fetchLatestGamesPage = async (pageNumber: number, abortSignal: AbortSignal) => {
  const launcherResult = await fetchLatestGamesPageViaLauncher(pageNumber)
  if (launcherResult) {
    return launcherResult
  }

  const endpointUrl = buildLatestGamesEndpointUrl(pageNumber)
  const response = await fetch(endpointUrl, {
    method: 'GET',
    signal: abortSignal,
    headers: {
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error(F95_COOKIE_REFRESH_ERROR_MESSAGE)
    }

    throw new Error(`Network error: ${response.status}`)
  }

  const responseText = await response.text()
  let parsedJson: F95ApiResponse

  try {
    parsedJson = JSON.parse(responseText) as F95ApiResponse
  } catch {
    throw new Error(F95_COOKIE_REFRESH_ERROR_MESSAGE)
  }

  if (!parsedJson || parsedJson.status !== 'ok' || !parsedJson.msg || !Array.isArray(parsedJson.msg.data)) {
    throw new Error(F95_COOKIE_REFRESH_ERROR_MESSAGE)
  }

  const threadItemList: F95ThreadItem[] = parsedJson.msg.data
  const pageFromResponse = parsedJson.msg.pagination?.page ?? pageNumber
  const totalPages = parsedJson.msg.pagination?.total ?? 0

  return {
    threadItemList,
    pageFromResponse,
    totalPages,
  }
}

export {
  buildThreadLink,
  fetchLatestGamesPage,
  F95_COOKIE_REFRESH_ERROR_MESSAGE,
  isLikelyCookieRefreshErrorMessage,
}
