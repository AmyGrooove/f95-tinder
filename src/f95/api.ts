import type { F95ApiResponse, F95ThreadItem } from './types'

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
  const endpointUrl = buildLatestGamesEndpointUrl(pageNumber)
  const response = await fetch(endpointUrl, {
    method: 'GET',
    signal: abortSignal,
    headers: {
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`Network error: ${response.status}`)
  }

  const parsedJson = (await response.json()) as F95ApiResponse

  if (!parsedJson || parsedJson.status !== 'ok' || !parsedJson.msg || !Array.isArray(parsedJson.msg.data)) {
    throw new Error('Unexpected API response shape')
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

export { buildThreadLink, fetchLatestGamesPage }
