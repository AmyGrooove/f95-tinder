import type {
  F95ApiResponse,
  F95ThreadItem,
  FilterState,
  LatestGamesSort,
} from './types'
import { fetchLatestGamesPageViaLauncher } from '../launcher/runtime'

const F95_ORIGIN = 'https://f95zone.to'

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

const buildThreadLink = (threadIdentifier: number) =>
  `${F95_ORIGIN}/threads/${threadIdentifier}`

const normalizeFiniteNumber = (value: unknown) => {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

const normalizeBoolean = (value: unknown) => value === true

const normalizeNumericIdList = (value: unknown) => {
  if (!Array.isArray(value)) {
    return []
  }

  return Array.from(
    new Set(
      value.filter(
        (item): item is number => Number.isInteger(item) && Number.isFinite(item),
      ),
    ),
  )
}

const normalizeStringArray = (value: unknown) => {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter((item): item is string => typeof item === 'string')
}

const normalizeThreadItem = (value: unknown): F95ThreadItem | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  const threadItem = value as Partial<F95ThreadItem>
  if (
    typeof threadItem.thread_id !== 'number' ||
    !Number.isInteger(threadItem.thread_id) ||
    !Number.isFinite(threadItem.thread_id) ||
    typeof threadItem.title !== 'string'
  ) {
    return null
  }

  return {
    thread_id: threadItem.thread_id,
    title: threadItem.title,
    creator: typeof threadItem.creator === 'string' ? threadItem.creator : '',
    version: typeof threadItem.version === 'string' ? threadItem.version : '',
    views: normalizeFiniteNumber(threadItem.views),
    likes: normalizeFiniteNumber(threadItem.likes),
    prefixes: normalizeNumericIdList(threadItem.prefixes),
    tags: normalizeNumericIdList(threadItem.tags),
    rating: normalizeFiniteNumber(threadItem.rating),
    cover: typeof threadItem.cover === 'string' ? threadItem.cover : '',
    screens: normalizeStringArray(threadItem.screens),
    date: typeof threadItem.date === 'string' ? threadItem.date : '',
    watched: normalizeBoolean(threadItem.watched),
    ignored: normalizeBoolean(threadItem.ignored),
    new: normalizeBoolean(threadItem.new),
    ts: normalizeFiniteNumber(threadItem.ts),
  }
}

const normalizeThreadItemList = (value: unknown) => {
  if (!Array.isArray(value)) {
    return []
  }

  return value.reduce<F95ThreadItem[]>((normalized, entry) => {
    const threadItem = normalizeThreadItem(entry)
    if (threadItem) {
      normalized.push(threadItem)
    }
    return normalized
  }, [])
}

const hasLatestGamesServerFilters = (filterState?: FilterState | null) => {
  if (!filterState) {
    return false
  }

  return (
    filterState.searchText.trim().length > 0 ||
    filterState.includeTagIds.length > 0 ||
    filterState.excludeTagIds.length > 0 ||
    filterState.includePrefixIds.length > 0 ||
    filterState.excludePrefixIds.length > 0
  )
}

const encodeLatestGamesRequestKey = (value: string) =>
  encodeURIComponent(value)
    .replace(/%5B/g, '[')
    .replace(/%5D/g, ']')

const serializeLatestGamesRequestEntries = (entries: Array<[string, string]>) => {
  return entries
    .map(
      ([key, value]) =>
        `${encodeLatestGamesRequestKey(key)}=${encodeURIComponent(value)}`,
    )
    .join('&')
}

const buildLatestGamesRequestEntries = (
  pageNumber: number,
  latestGamesSort: LatestGamesSort,
  filterState?: FilterState | null,
  includeTimestamp = true,
) => {
  const entries: Array<[string, string]> = [
    ['cmd', 'list'],
    ['cat', 'games'],
    ['page', String(pageNumber)],
  ]

  if (filterState && hasLatestGamesServerFilters(filterState)) {
    const searchText = filterState.searchText.trim()

    if (searchText.length > 0) {
      entries.push(['search', searchText])
    }

    filterState.includePrefixIds.forEach((prefixId) => {
      entries.push(['prefixes[]', String(prefixId)])
    })
    filterState.excludePrefixIds.forEach((prefixId) => {
      entries.push(['noprefixes[]', String(prefixId)])
    })
    filterState.includeTagIds.forEach((tagId) => {
      entries.push(['tags[]', String(tagId)])
    })
    filterState.excludeTagIds.forEach((tagId) => {
      entries.push(['notags[]', String(tagId)])
    })
  }

  entries.push(['sort', latestGamesSort])

  if (includeTimestamp) {
    entries.push(['_', String(Date.now())])
  }

  return entries
}

const buildLatestGamesEndpointUrl = (
  pageNumber: number,
  latestGamesSort: LatestGamesSort,
  filterState?: FilterState | null,
) => {
  const requestEntries = buildLatestGamesRequestEntries(
    pageNumber,
    latestGamesSort,
    filterState,
  )

  return `/f95/sam/latest_alpha/latest_data.php?${serializeLatestGamesRequestEntries(requestEntries)}`
}

const buildLatestGamesDataRequestUrl = (
  pageNumber: number,
  latestGamesSort: LatestGamesSort,
  filterState?: FilterState | null,
) => {
  const requestEntries = buildLatestGamesRequestEntries(
    pageNumber,
    latestGamesSort,
    filterState,
    false,
  )

  return `${F95_ORIGIN}/sam/latest_alpha/latest_data.php?${serializeLatestGamesRequestEntries(requestEntries)}`
}

const fetchLatestGamesPage = async (
  pageNumber: number,
  abortSignal: AbortSignal,
  latestGamesSort: LatestGamesSort,
  filterState?: FilterState | null,
) => {
  const launcherResult = await fetchLatestGamesPageViaLauncher(
    pageNumber,
    latestGamesSort,
    filterState,
  )
  if (launcherResult) {
    return {
      ...launcherResult,
      threadItemList: normalizeThreadItemList(launcherResult.threadItemList),
      pageFromResponse:
        typeof launcherResult.pageFromResponse === 'number'
          ? launcherResult.pageFromResponse
          : pageNumber,
      totalPages:
        typeof launcherResult.totalPages === 'number' ? launcherResult.totalPages : 0,
    }
  }

  const endpointUrl = buildLatestGamesEndpointUrl(
    pageNumber,
    latestGamesSort,
    filterState,
  )
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

  const threadItemList = normalizeThreadItemList(parsedJson.msg.data)
  const pageFromResponse = parsedJson.msg.pagination?.page ?? pageNumber
  const totalPages = parsedJson.msg.pagination?.total ?? 0

  return {
    threadItemList,
    pageFromResponse,
    totalPages,
  }
}

export {
  buildLatestGamesDataRequestUrl,
  buildThreadLink,
  fetchLatestGamesPage,
  F95_COOKIE_REFRESH_ERROR_MESSAGE,
  hasLatestGamesServerFilters,
  isLikelyCookieRefreshErrorMessage,
}
