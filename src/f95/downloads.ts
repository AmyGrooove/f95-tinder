import type { DownloadGroup, ThreadDownloadsData } from './types'
import { safeJsonParse } from './utils'

const F95_ORIGIN = 'https://f95zone.to'
const DOWNLOAD_CACHE_PREFIX = 'f95_tinder_downloads_v2_'
const DOWNLOAD_CACHE_INDEX_KEY = 'f95_tinder_downloads_index_v2'
const DOWNLOAD_CACHE_TTL_MS = 1000 * 60 * 60 * 6
const DOWNLOAD_CACHE_MAX_ENTRIES = 60
const DOWNLOAD_HOST_PREFERENCES_KEY = 'f95_tinder_download_host_preferences_v1'
const DISABLED_DOWNLOAD_HOSTS_KEY = 'f95_tinder_disabled_download_hosts_v1'
const HIDDEN_DOWNLOAD_HOSTS_KEY = 'f95_tinder_hidden_download_hosts_v1'
const TEMPORARY_DISABLED_HOST_DURATION_MS = 1000 * 60 * 60
const DEFAULT_PREFERRED_DOWNLOAD_HOSTS = [
  'PIXELDRAIN',
  'GOFILE',
  'MEGA',
  'BUZZHEAVIER',
  'WORKUPLOAD',
  'DATANODES',
  'VIKINGFILE',
  'MEDIAFIRE',
] as const
const HIDDEN_DOWNLOAD_GROUP_PATTERNS = [
  /\bmac(os)?\b/i,
  /\blinux\b/i,
  /\bandroid\b/i,
  /\bandorid\b/i,
  /\bios\b/i,
]
const inflightDownloadsByThreadLink = new Map<string, Promise<ThreadDownloadsData>>()

const normalizeWhitespace = (value: string) => {
  return value.replace(/\u200b/g, ' ').replace(/\s+/g, ' ').trim()
}

const normalizeGroupLabel = (value: string) => {
  return normalizeWhitespace(value).replace(/:$/, '')
}

const normalizeLinkLabelForMatch = (value: string) => {
  return normalizeWhitespace(value)
    .replace(/^[^A-Za-z0-9]+/, '')
    .toLowerCase()
}

const normalizeDownloadHostLabel = (value: string) => {
  return normalizeWhitespace(value)
    .replace(/^[^A-Za-z0-9]+/, '')
    .toUpperCase()
}

const normalizeDownloadHostLabelList = (hostLabelList: string[]) => {
  return hostLabelList
    .map((item) => normalizeDownloadHostLabel(item))
    .filter((item, index, array) => item.length > 0 && array.indexOf(item) === index)
}

const parseThreadIdentifierFromLink = (threadLink: string) => {
  const match = /\/threads\/(\d+)/.exec(threadLink)
  if (!match) {
    return null
  }

  return Number(match[1])
}

const getDownloadCacheKey = (threadLink: string) => {
  const threadIdentifier = parseThreadIdentifierFromLink(threadLink)
  return threadIdentifier !== null
    ? `${DOWNLOAD_CACHE_PREFIX}${threadIdentifier}`
    : `${DOWNLOAD_CACHE_PREFIX}${encodeURIComponent(threadLink)}`
}

const loadDownloadCacheIndex = () => {
  try {
    const rawValue = localStorage.getItem(DOWNLOAD_CACHE_INDEX_KEY)
    if (!rawValue) {
      return []
    }

    const parsedValue = safeJsonParse<unknown>(rawValue)
    if (!Array.isArray(parsedValue)) {
      return []
    }

    return parsedValue.filter((item): item is string => {
      return typeof item === 'string' && item.trim().length > 0
    })
  } catch {
    return []
  }
}

const saveDownloadCacheIndex = (threadLinkList: string[]) => {
  try {
    localStorage.setItem(DOWNLOAD_CACHE_INDEX_KEY, JSON.stringify(threadLinkList))
  } catch {
    // ignore
  }
}

const removeThreadLinkFromDownloadCacheIndex = (threadLink: string) => {
  const nextThreadLinkList = loadDownloadCacheIndex().filter((item) => item !== threadLink)
  saveDownloadCacheIndex(nextThreadLinkList)
}

const markThreadDownloadsAsCached = (threadLink: string) => {
  const currentThreadLinkList = loadDownloadCacheIndex().filter((item) => item !== threadLink)
  currentThreadLinkList.push(threadLink)

  const overflowCount = Math.max(0, currentThreadLinkList.length - DOWNLOAD_CACHE_MAX_ENTRIES)
  const nextThreadLinkList = currentThreadLinkList.slice(overflowCount)

  for (const linkToRemove of currentThreadLinkList.slice(0, overflowCount)) {
    try {
      localStorage.removeItem(getDownloadCacheKey(linkToRemove))
    } catch {
      // ignore
    }
  }

  saveDownloadCacheIndex(nextThreadLinkList)
}

const buildThreadPageProxyUrl = (threadLink: string) => {
  const parsedUrl = new URL(threadLink)
  return `/f95${parsedUrl.pathname}${parsedUrl.search}`
}

const toAbsoluteUrl = (href: string) => {
  try {
    return new URL(href, F95_ORIGIN).toString()
  } catch {
    return href
  }
}

const createEmptyThreadDownloadsData = (
  threadLink: string,
  status: ThreadDownloadsData['status'],
  groups: DownloadGroup[],
  requiresAuth: boolean,
): ThreadDownloadsData => {
  return {
    status,
    groups,
    requiresAuth,
    threadLink,
    fetchedAtUnixMs: Date.now(),
  }
}

const shouldHideDownloadGroup = (groupLabel: string) => {
  return HIDDEN_DOWNLOAD_GROUP_PATTERNS.some((pattern) => pattern.test(groupLabel))
}

const isDownloadHeadingElement = (element: Element) => {
  const tagName = element.tagName.toLowerCase()
  if (tagName !== 'b' && tagName !== 'strong' && tagName !== 'span') {
    return false
  }

  return normalizeWhitespace(element.textContent ?? '').toLowerCase() === 'download'
}

const isDownloadGroupLabelElement = (element: Element) => {
  const tagName = element.tagName.toLowerCase()
  if (tagName !== 'b' && tagName !== 'strong') {
    return false
  }

  const textValue = normalizeGroupLabel(element.textContent ?? '')
  if (!textValue) {
    return false
  }

  return textValue.toLowerCase() !== 'download'
}

const findDownloadSectionRoot = (documentNode: Document) => {
  const wrapperList = Array.from(
    documentNode.querySelectorAll('.message-userContent .bbWrapper'),
  )

  for (const wrapperElement of wrapperList) {
    const headingElement = Array.from(
      wrapperElement.querySelectorAll('b, strong, span'),
    ).find((element) => isDownloadHeadingElement(element))

    if (!headingElement) {
      continue
    }

    return (
      headingElement.closest('div[style*="text-align: center"]') ??
      headingElement.closest('.bbWrapper') ??
      wrapperElement
    )
  }

  return null
}

const parseFallbackGroupsFromText = (sourceText: string): DownloadGroup[] => {
  const normalizedText = sourceText.replace(/\r/g, '').replace(/\u200b/g, '')
  const markerIndex = normalizedText.toUpperCase().indexOf('DOWNLOAD')
  if (markerIndex < 0) {
    return []
  }

  const tailText = normalizedText.slice(markerIndex + 'DOWNLOAD'.length)
  const lineList = tailText
    .split('\n')
    .map((line) => normalizeWhitespace(line))
    .filter((line) => line.length > 0)

  const groupList: DownloadGroup[] = []

  for (const line of lineList) {
    const match = /^([A-Za-z0-9+ /_-]+)\s*:\s*(.+)$/.exec(line)
    if (!match) {
      if (groupList.length > 0) {
        break
      }

      continue
    }

    const label = normalizeGroupLabel(match[1])
    const linkLabelList = match[2]
      .split(/\s+-\s+/)
      .map((value) => normalizeWhitespace(value))
      .filter((value) => value.length > 0)

    if (!label || linkLabelList.length === 0) {
      continue
    }

    groupList.push({
      label,
      links: linkLabelList.map((linkLabel) => ({
        label: linkLabel,
        url: null,
        isMasked: false,
      })),
    })
  }

  return groupList
}

const extractStructuredTextCandidates = (value: unknown): string[] => {
  if (!value) {
    return []
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => extractStructuredTextCandidates(item))
  }

  if (typeof value !== 'object') {
    return []
  }

  const record = value as Record<string, unknown>
  const textList: string[] = []

  if (typeof record.articleBody === 'string') {
    textList.push(record.articleBody)
  }

  if (typeof record.description === 'string') {
    textList.push(record.description)
  }

  return textList
}

const parseFallbackGroupsFromStructuredData = (documentNode: Document) => {
  const scriptList = Array.from(
    documentNode.querySelectorAll('script[type="application/ld+json"]'),
  )

  for (const scriptElement of scriptList) {
    const parsedValue = safeJsonParse<unknown>(scriptElement.textContent ?? '')
    if (!parsedValue) {
      continue
    }

    const candidateTextList = extractStructuredTextCandidates(parsedValue)
    for (const candidateText of candidateTextList) {
      const fallbackGroupList = parseFallbackGroupsFromText(candidateText)
      if (fallbackGroupList.length > 0) {
        return fallbackGroupList
      }
    }
  }

  return []
}

const parseDownloadGroupsFromSection = (sectionRoot: Element) => {
  const groupList: DownloadGroup[] = []
  const groupByLabel = new Map<string, DownloadGroup>()
  let hasHiddenLinks = false
  let hasReachedDownloadHeading = false
  let currentGroupLabel: string | null = null

  const ensureGroup = (groupLabel: string) => {
    const existingGroup = groupByLabel.get(groupLabel)
    if (existingGroup) {
      return existingGroup
    }

    const nextGroup: DownloadGroup = {
      label: groupLabel,
      links: [],
    }
    groupByLabel.set(groupLabel, nextGroup)
    groupList.push(nextGroup)
    return nextGroup
  }

  const elementList = Array.from(sectionRoot.querySelectorAll('*'))
  for (const element of elementList) {
    if (!hasReachedDownloadHeading) {
      if (isDownloadHeadingElement(element)) {
        hasReachedDownloadHeading = true
        currentGroupLabel = null
      }
      continue
    }

    if (
      element.tagName.toLowerCase() === 'a' &&
      element.querySelector('img.bbImage')
    ) {
      break
    }

    if (
      element.tagName.toLowerCase() === 'img' &&
      element.classList.contains('bbImage')
    ) {
      break
    }

    if (element.classList.contains('messageHide--link')) {
      hasHiddenLinks = true
      continue
    }

    if (isDownloadGroupLabelElement(element)) {
      currentGroupLabel = normalizeGroupLabel(element.textContent ?? '')
      if (currentGroupLabel) {
        ensureGroup(currentGroupLabel)
      }
      continue
    }

    if (element.tagName.toLowerCase() !== 'a' || !currentGroupLabel) {
      continue
    }

    const href = element.getAttribute('href')
    const label = normalizeWhitespace(element.textContent ?? '')
    if (!href || !label) {
      continue
    }

    const absoluteUrl = toAbsoluteUrl(href)
    if (absoluteUrl === `${F95_ORIGIN}/login/`) {
      continue
    }

    const group = ensureGroup(currentGroupLabel)
    const isAlreadyPresent = group.links.some((link) => {
      return link.label === label && link.url === absoluteUrl
    })

    if (isAlreadyPresent) {
      continue
    }

    group.links.push({
      label,
      url: absoluteUrl,
      isMasked: absoluteUrl.includes('/masked/'),
    })
  }

  return {
    groupList,
    hasHiddenLinks,
  }
}

const alignActualGroupsWithFallback = (
  actualGroupList: DownloadGroup[],
  fallbackGroupList: DownloadGroup[],
) => {
  if (actualGroupList.length === 0 || fallbackGroupList.length === 0) {
    return actualGroupList
  }

  const actualLinkList = actualGroupList.flatMap((group) => group.links)
  const fallbackLinkList = fallbackGroupList.flatMap((group) => group.links)

  if (actualLinkList.length !== fallbackLinkList.length) {
    return actualGroupList
  }

  const labelsMatch = actualLinkList.every((actualLink, index) => {
    const fallbackLink = fallbackLinkList[index]
    if (!fallbackLink) {
      return false
    }

    return (
      normalizeLinkLabelForMatch(actualLink.label) ===
      normalizeLinkLabelForMatch(fallbackLink.label)
    )
  })

  if (!labelsMatch) {
    return actualGroupList
  }

  let actualLinkIndex = 0

  return fallbackGroupList.map((fallbackGroup) => {
    const nextLinks = actualLinkList.slice(
      actualLinkIndex,
      actualLinkIndex + fallbackGroup.links.length,
    )
    actualLinkIndex += fallbackGroup.links.length

    return {
      label: fallbackGroup.label,
      links: nextLinks,
    }
  })
}

const isThreadDownloadsData = (value: unknown): value is ThreadDownloadsData => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }

  const candidate = value as Partial<ThreadDownloadsData>
  if (
    candidate.status !== 'available' &&
    candidate.status !== 'login_required' &&
    candidate.status !== 'not_found'
  ) {
    return false
  }

  if (!Array.isArray(candidate.groups)) {
    return false
  }

  if (typeof candidate.threadLink !== 'string') {
    return false
  }

  if (typeof candidate.fetchedAtUnixMs !== 'number') {
    return false
  }

  for (const group of candidate.groups) {
    if (!group || typeof group !== 'object' || Array.isArray(group)) {
      return false
    }

    const groupValue = group as DownloadGroup
    if (typeof groupValue.label !== 'string' || !Array.isArray(groupValue.links)) {
      return false
    }

    for (const link of groupValue.links) {
      if (!link || typeof link !== 'object' || Array.isArray(link)) {
        return false
      }

      if (typeof link.label !== 'string') {
        return false
      }

      if (link.url !== null && typeof link.url !== 'string') {
        return false
      }

      if (typeof link.isMasked !== 'boolean') {
        return false
      }
    }
  }

  return typeof candidate.requiresAuth === 'boolean'
}

const parseThreadDownloadsFromHtml = (
  htmlText: string,
  threadLink: string,
): ThreadDownloadsData => {
  const parser = new DOMParser()
  const documentNode = parser.parseFromString(htmlText, 'text/html')
  const fallbackGroupList = parseFallbackGroupsFromStructuredData(documentNode)
  const sectionRoot = findDownloadSectionRoot(documentNode)

  if (!sectionRoot) {
    return createEmptyThreadDownloadsData(
      threadLink,
      fallbackGroupList.length > 0 ? 'login_required' : 'not_found',
      fallbackGroupList,
      fallbackGroupList.length > 0,
    )
  }

  const { groupList, hasHiddenLinks } = parseDownloadGroupsFromSection(sectionRoot)
  const actualLinkCount = groupList.reduce((count, group) => {
    return count + group.links.filter((link) => link.url !== null).length
  }, 0)

  if (actualLinkCount > 0) {
    return createEmptyThreadDownloadsData(
      threadLink,
      'available',
      alignActualGroupsWithFallback(groupList, fallbackGroupList),
      false,
    )
  }

  if (hasHiddenLinks || fallbackGroupList.length > 0) {
    return createEmptyThreadDownloadsData(
      threadLink,
      'login_required',
      fallbackGroupList,
      true,
    )
  }

  return createEmptyThreadDownloadsData(threadLink, 'not_found', [], false)
}

const loadCachedThreadDownloads = (threadLink: string) => {
  try {
    const rawValue = localStorage.getItem(getDownloadCacheKey(threadLink))
    if (!rawValue) {
      return null
    }

    const parsedValue = safeJsonParse<unknown>(rawValue)
    if (!isThreadDownloadsData(parsedValue)) {
      return null
    }

    if (Date.now() - parsedValue.fetchedAtUnixMs > DOWNLOAD_CACHE_TTL_MS) {
      try {
        localStorage.removeItem(getDownloadCacheKey(threadLink))
      } catch {
        // ignore
      }
      removeThreadLinkFromDownloadCacheIndex(threadLink)
      return null
    }

    return parsedValue
  } catch {
    return null
  }
}

const saveCachedThreadDownloads = (threadDownloadsData: ThreadDownloadsData) => {
  if (threadDownloadsData.status !== 'available') {
    return
  }

  try {
    localStorage.setItem(
      getDownloadCacheKey(threadDownloadsData.threadLink),
      JSON.stringify(threadDownloadsData),
    )
    markThreadDownloadsAsCached(threadDownloadsData.threadLink)
  } catch {
    // ignore
  }
}

const removeCachedThreadDownloads = (threadLink: string) => {
  try {
    localStorage.removeItem(getDownloadCacheKey(threadLink))
  } catch {
    // ignore
  }

  removeThreadLinkFromDownloadCacheIndex(threadLink)
}

const clearAllCachedThreadDownloads = () => {
  const cachedThreadLinks = loadDownloadCacheIndex()
  for (const threadLink of cachedThreadLinks) {
    try {
      localStorage.removeItem(getDownloadCacheKey(threadLink))
    } catch {
      // ignore
    }
  }

  try {
    localStorage.removeItem(DOWNLOAD_CACHE_INDEX_KEY)
  } catch {
    // ignore
  }
}

const loadPreferredDownloadHosts = () => {
  try {
    const rawValue = localStorage.getItem(DOWNLOAD_HOST_PREFERENCES_KEY)
    if (!rawValue) {
      return [...DEFAULT_PREFERRED_DOWNLOAD_HOSTS]
    }

    const parsedValue = safeJsonParse<unknown>(rawValue)
    if (!Array.isArray(parsedValue)) {
      return [...DEFAULT_PREFERRED_DOWNLOAD_HOSTS]
    }

    const normalizedHostList = normalizeDownloadHostLabelList(
      parsedValue.filter((item): item is string => typeof item === 'string'),
    )

    return normalizedHostList.length > 0
      ? normalizedHostList
      : [...DEFAULT_PREFERRED_DOWNLOAD_HOSTS]
  } catch {
    return [...DEFAULT_PREFERRED_DOWNLOAD_HOSTS]
  }
}

const savePreferredDownloadHosts = (hostLabelList: string[]) => {
  const normalizedHostList = normalizeDownloadHostLabelList(hostLabelList)

  try {
    localStorage.setItem(
      DOWNLOAD_HOST_PREFERENCES_KEY,
      JSON.stringify(normalizedHostList),
    )
  } catch {
    // ignore
  }
}

const resetPreferredDownloadHosts = () => {
  try {
    localStorage.removeItem(DOWNLOAD_HOST_PREFERENCES_KEY)
  } catch {
    // ignore
  }

  return [...DEFAULT_PREFERRED_DOWNLOAD_HOSTS]
}

const loadHiddenDownloadHosts = () => {
  try {
    const rawValue = localStorage.getItem(HIDDEN_DOWNLOAD_HOSTS_KEY)
    if (!rawValue) {
      return []
    }

    const parsedValue = safeJsonParse<unknown>(rawValue)
    if (!Array.isArray(parsedValue)) {
      return []
    }

    return normalizeDownloadHostLabelList(
      parsedValue.filter((item): item is string => typeof item === 'string'),
    )
  } catch {
    return []
  }
}

const saveHiddenDownloadHosts = (hostLabelList: string[]) => {
  const normalizedHostList = normalizeDownloadHostLabelList(hostLabelList)

  try {
    localStorage.setItem(
      HIDDEN_DOWNLOAD_HOSTS_KEY,
      JSON.stringify(normalizedHostList),
    )
  } catch {
    // ignore
  }
}

const isDownloadHostHidden = (
  hostLabel: string,
  hiddenHostLabelList: string[],
) => {
  const normalizedHostLabel = normalizeDownloadHostLabel(hostLabel)
  if (!normalizedHostLabel) {
    return false
  }

  return normalizeDownloadHostLabelList(hiddenHostLabelList).includes(
    normalizedHostLabel,
  )
}

const hideDownloadHost = (hostLabel: string) => {
  const normalizedHostLabel = normalizeDownloadHostLabel(hostLabel)
  if (!normalizedHostLabel) {
    return loadHiddenDownloadHosts()
  }

  const nextHiddenHostList = normalizeDownloadHostLabelList([
    ...loadHiddenDownloadHosts(),
    normalizedHostLabel,
  ])
  saveHiddenDownloadHosts(nextHiddenHostList)
  return nextHiddenHostList
}

const showDownloadHost = (hostLabel: string) => {
  const normalizedHostLabel = normalizeDownloadHostLabel(hostLabel)
  const nextHiddenHostList = loadHiddenDownloadHosts().filter(
    (item) => item !== normalizedHostLabel,
  )
  saveHiddenDownloadHosts(nextHiddenHostList)
  return nextHiddenHostList
}

const clearHiddenDownloadHosts = () => {
  try {
    localStorage.removeItem(HIDDEN_DOWNLOAD_HOSTS_KEY)
  } catch {
    // ignore
  }
}

const pruneDisabledDownloadHosts = (disabledHostMap: Record<string, number>) => {
  const now = Date.now()
  const nextDisabledHostMap: Record<string, number> = {}

  for (const hostLabel of Object.keys(disabledHostMap)) {
    const expiresAtUnixMs = disabledHostMap[hostLabel]
    if (typeof expiresAtUnixMs !== 'number' || expiresAtUnixMs <= now) {
      continue
    }

    nextDisabledHostMap[normalizeDownloadHostLabel(hostLabel)] = expiresAtUnixMs
  }

  return nextDisabledHostMap
}

const saveDisabledDownloadHosts = (disabledHostMap: Record<string, number>) => {
  try {
    localStorage.setItem(
      DISABLED_DOWNLOAD_HOSTS_KEY,
      JSON.stringify(pruneDisabledDownloadHosts(disabledHostMap)),
    )
  } catch {
    // ignore
  }
}

const loadDisabledDownloadHosts = () => {
  try {
    const rawValue = localStorage.getItem(DISABLED_DOWNLOAD_HOSTS_KEY)
    if (!rawValue) {
      return {}
    }

    const parsedValue = safeJsonParse<unknown>(rawValue)
    if (!parsedValue || typeof parsedValue !== 'object' || Array.isArray(parsedValue)) {
      return {}
    }

    const nextDisabledHostMap: Record<string, number> = {}

    for (const [hostLabel, expiresAtUnixMs] of Object.entries(parsedValue)) {
      if (typeof expiresAtUnixMs !== 'number') {
        continue
      }

      nextDisabledHostMap[normalizeDownloadHostLabel(hostLabel)] = expiresAtUnixMs
    }

    const prunedDisabledHostMap = pruneDisabledDownloadHosts(nextDisabledHostMap)
    if (Object.keys(prunedDisabledHostMap).length !== Object.keys(nextDisabledHostMap).length) {
      saveDisabledDownloadHosts(prunedDisabledHostMap)
    }

    return prunedDisabledHostMap
  } catch {
    return {}
  }
}

const isDownloadHostTemporarilyDisabled = (
  hostLabel: string,
  disabledHostMap: Record<string, number>,
) => {
  const normalizedHostLabel = normalizeDownloadHostLabel(hostLabel)
  const expiresAtUnixMs = disabledHostMap[normalizedHostLabel]
  return typeof expiresAtUnixMs === 'number' && expiresAtUnixMs > Date.now()
}

const disableDownloadHostTemporarily = (
  hostLabel: string,
  durationMs = TEMPORARY_DISABLED_HOST_DURATION_MS,
) => {
  const normalizedHostLabel = normalizeDownloadHostLabel(hostLabel)
  if (!normalizedHostLabel) {
    return loadDisabledDownloadHosts()
  }

  const nextDisabledHostMap = {
    ...loadDisabledDownloadHosts(),
    [normalizedHostLabel]: Date.now() + durationMs,
  }

  saveDisabledDownloadHosts(nextDisabledHostMap)
  return nextDisabledHostMap
}

const enableDownloadHost = (hostLabel: string) => {
  const normalizedHostLabel = normalizeDownloadHostLabel(hostLabel)
  const nextDisabledHostMap = { ...loadDisabledDownloadHosts() }
  delete nextDisabledHostMap[normalizedHostLabel]
  saveDisabledDownloadHosts(nextDisabledHostMap)
  return nextDisabledHostMap
}

const clearDisabledDownloadHosts = () => {
  try {
    localStorage.removeItem(DISABLED_DOWNLOAD_HOSTS_KEY)
  } catch {
    // ignore
  }
}

const promotePreferredDownloadHost = (
  currentHostLabelList: string[],
  nextPrimaryHostLabel: string,
) => {
  const normalizedPrimaryHostLabel = normalizeDownloadHostLabel(nextPrimaryHostLabel)
  if (!normalizedPrimaryHostLabel) {
    return currentHostLabelList
  }

  const normalizedCurrentHostList = currentHostLabelList
    .map((item) => normalizeDownloadHostLabel(item))
    .filter((item, index, array) => item.length > 0 && array.indexOf(item) === index)

  return [
    normalizedPrimaryHostLabel,
    ...normalizedCurrentHostList.filter((item) => item !== normalizedPrimaryHostLabel),
  ]
}

const moveDownloadHostPreference = (
  currentHostLabelList: string[],
  hostLabelToMove: string,
  targetIndex: number,
) => {
  const normalizedHostLabel = normalizeDownloadHostLabel(hostLabelToMove)
  const normalizedCurrentHostList = normalizeDownloadHostLabelList(currentHostLabelList)
  const currentIndex = normalizedCurrentHostList.indexOf(normalizedHostLabel)

  if (currentIndex === -1) {
    return normalizedCurrentHostList
  }

  const boundedTargetIndex = Math.max(
    0,
    Math.min(targetIndex, normalizedCurrentHostList.length - 1),
  )
  if (boundedTargetIndex === currentIndex) {
    return normalizedCurrentHostList
  }

  const nextHostList = [...normalizedCurrentHostList]
  nextHostList.splice(currentIndex, 1)
  nextHostList.splice(boundedTargetIndex, 0, normalizedHostLabel)
  return nextHostList
}

const sortDownloadHostsByPreference = (
  hostLabelList: string[],
  preferredHostLabelList: string[],
) => {
  const normalizedPreferredHostList = preferredHostLabelList.map((item) =>
    normalizeDownloadHostLabel(item),
  )

  return [...hostLabelList].sort((first, second) => {
    const firstIndex = normalizedPreferredHostList.indexOf(
      normalizeDownloadHostLabel(first),
    )
    const secondIndex = normalizedPreferredHostList.indexOf(
      normalizeDownloadHostLabel(second),
    )

    const firstRank = firstIndex === -1 ? Number.MAX_SAFE_INTEGER : firstIndex
    const secondRank = secondIndex === -1 ? Number.MAX_SAFE_INTEGER : secondIndex

    if (firstRank !== secondRank) {
      return firstRank - secondRank
    }

    return first.localeCompare(second)
  })
}

const collectDownloadHostLabels = (threadDownloadsData: ThreadDownloadsData) => {
  const hostLabelList: string[] = []

  for (const group of threadDownloadsData.groups) {
    if (shouldHideDownloadGroup(group.label)) {
      continue
    }

    for (const link of group.links) {
      const normalizedHostLabel = normalizeDownloadHostLabel(link.label)
      if (!normalizedHostLabel || hostLabelList.includes(normalizedHostLabel)) {
        continue
      }

      hostLabelList.push(normalizedHostLabel)
    }
  }

  return hostLabelList
}

const findBestDownloadLink = (
  threadDownloadsData: ThreadDownloadsData,
  preferredHostLabelList: string[],
  disabledHostMap: Record<string, number> = {},
  hiddenHostLabelList: string[] = [],
) => {
  const normalizedPreferredHostList = preferredHostLabelList.map((item) =>
    normalizeDownloadHostLabel(item),
  )

  for (const group of threadDownloadsData.groups) {
    if (shouldHideDownloadGroup(group.label)) {
      continue
    }

    const availableLinkList = group.links.filter((link) => {
      return (
        typeof link.url === 'string' &&
        !isDownloadHostTemporarilyDisabled(link.label, disabledHostMap) &&
        !isDownloadHostHidden(link.label, hiddenHostLabelList)
      )
    })
    if (availableLinkList.length === 0) {
      continue
    }

    return [...availableLinkList].sort((first, second) => {
      const firstIndex = normalizedPreferredHostList.indexOf(
        normalizeDownloadHostLabel(first.label),
      )
      const secondIndex = normalizedPreferredHostList.indexOf(
        normalizeDownloadHostLabel(second.label),
      )

      const firstRank = firstIndex === -1 ? Number.MAX_SAFE_INTEGER : firstIndex
      const secondRank = secondIndex === -1 ? Number.MAX_SAFE_INTEGER : secondIndex

      if (firstRank !== secondRank) {
        return firstRank - secondRank
      }

      return first.label.localeCompare(second.label)
    })[0] ?? null
  }

  return null
}

const fetchThreadDownloadsFromNetwork = async (
  threadLink: string,
  abortSignal?: AbortSignal,
) => {
  const response = await fetch(buildThreadPageProxyUrl(threadLink), {
    method: 'GET',
    signal: abortSignal,
    headers: {
      Accept: 'text/html',
    },
  })

  if (!response.ok) {
    throw new Error(`Не удалось загрузить тред: ${response.status}`)
  }

  const htmlText = await response.text()
  return parseThreadDownloadsFromHtml(htmlText, threadLink)
}

const fetchThreadDownloads = async (
  threadLink: string,
  abortSignal?: AbortSignal,
) => {
  if (abortSignal) {
    return fetchThreadDownloadsFromNetwork(threadLink, abortSignal)
  }

  const existingRequest = inflightDownloadsByThreadLink.get(threadLink)
  if (existingRequest) {
    return existingRequest
  }

  const nextRequest = fetchThreadDownloadsFromNetwork(threadLink).finally(() => {
    inflightDownloadsByThreadLink.delete(threadLink)
  })

  inflightDownloadsByThreadLink.set(threadLink, nextRequest)
  return nextRequest
}

const loadOrFetchThreadDownloads = async (
  threadLink: string,
  abortSignal?: AbortSignal,
) => {
  const cachedDownloads = loadCachedThreadDownloads(threadLink)
  if (cachedDownloads) {
    return cachedDownloads
  }

  const downloadsData = await fetchThreadDownloads(threadLink, abortSignal)
  saveCachedThreadDownloads(downloadsData)
  return downloadsData
}

const loadKnownDownloadHosts = () => {
  const hostLabelSet = new Set<string>(DEFAULT_PREFERRED_DOWNLOAD_HOSTS)
  const cachedThreadLinks = loadDownloadCacheIndex()

  for (const threadLink of cachedThreadLinks) {
    const cachedDownloads = loadCachedThreadDownloads(threadLink)
    if (!cachedDownloads) {
      continue
    }

    for (const hostLabel of collectDownloadHostLabels(cachedDownloads)) {
      hostLabelSet.add(hostLabel)
    }
  }

  for (const hostLabel of loadPreferredDownloadHosts()) {
    hostLabelSet.add(hostLabel)
  }

  for (const hostLabel of Object.keys(loadDisabledDownloadHosts())) {
    hostLabelSet.add(hostLabel)
  }

  for (const hostLabel of loadHiddenDownloadHosts()) {
    hostLabelSet.add(hostLabel)
  }

  return Array.from(hostLabelSet)
}

export {
  clearHiddenDownloadHosts,
  clearDisabledDownloadHosts,
  clearAllCachedThreadDownloads,
  collectDownloadHostLabels,
  disableDownloadHostTemporarily,
  enableDownloadHost,
  fetchThreadDownloads,
  findBestDownloadLink,
  hideDownloadHost,
  isDownloadHostHidden,
  loadCachedThreadDownloads,
  loadDisabledDownloadHosts,
  loadHiddenDownloadHosts,
  loadKnownDownloadHosts,
  loadOrFetchThreadDownloads,
  loadPreferredDownloadHosts,
  moveDownloadHostPreference,
  promotePreferredDownloadHost,
  removeCachedThreadDownloads,
  resetPreferredDownloadHosts,
  saveCachedThreadDownloads,
  saveHiddenDownloadHosts,
  savePreferredDownloadHosts,
  showDownloadHost,
  shouldHideDownloadGroup,
  sortDownloadHostsByPreference,
  TEMPORARY_DISABLED_HOST_DURATION_MS,
}
