import type { DownloadChoice, DownloadGroup, DownloadLink, ThreadDownloadsData } from './types'
import { fetchThreadPageHtmlViaLauncher } from '../launcher/runtime'
import {
  getLauncherLocalDataSnapshotSync,
  saveLauncherLocalSettingsSync,
} from '../launcher/runtime'
import {
  loadDefaultSwipeSettings,
  loadPrefixesMap,
  loadTagsMap,
  normalizeDefaultSwipeSettings,
  normalizePrefixesMap,
  normalizeTagsMap,
} from './storage'
import { safeJsonParse } from './utils'

const F95_ORIGIN = 'https://f95zone.to'
const DOWNLOAD_CACHE_PREFIX = 'f95_tinder_downloads_v3_'
const DOWNLOAD_CACHE_INDEX_KEY = 'f95_tinder_downloads_index_v3'
const DOWNLOAD_CACHE_TTL_MS = 1000 * 60 * 60 * 6
const DOWNLOAD_CACHE_MAX_ENTRIES = 60
const DOWNLOAD_HOST_PREFERENCES_KEY = 'f95_tinder_download_host_preferences_v2'
const DISABLED_DOWNLOAD_HOSTS_KEY = 'f95_tinder_disabled_download_hosts_v1'
const HIDDEN_DOWNLOAD_HOSTS_KEY = 'f95_tinder_hidden_download_hosts_v1'
const TEMPORARY_DISABLED_HOST_DURATION_MS = 1000 * 60 * 60
const SUPPORTED_DOWNLOAD_HOSTS = [
  'GOFILE',
  'PIXELDRAIN',
  'DATANODES',
] as const
const DEFAULT_PREFERRED_DOWNLOAD_HOSTS = [...SUPPORTED_DOWNLOAD_HOSTS]
const SUPPORTED_DOWNLOAD_HOST_SET = new Set<string>(SUPPORTED_DOWNLOAD_HOSTS)
const HIDDEN_DOWNLOAD_GROUP_PATTERNS = [
  /\bmac(os)?\b/i,
  /\blinux\b/i,
  /\bandroid\b/i,
  /\bandorid\b/i,
  /\bios\b/i,
]
const NON_DOWNLOAD_LINK_LABEL_PATTERNS = [
  /\bwalkthrough\b/i,
  /\bguide(s)?\b/i,
  /\bfaq(s)?\b/i,
  /\bcheat(s)?\b/i,
  /\bbonus\b/i,
  /\bcoin\b/i,
  /\blocation(s)?\b/i,
  /\bremake\b/i,
  /\bforce\s+run\b/i,
]
const HOST_LABEL_BY_DOMAIN_SUFFIX = [
  ['gofile.io', 'GOFILE'],
  ['pixeldrain.com', 'PIXELDRAIN'],
  ['datanodes.to', 'DATANODES'],
  ['datanodes.cc', 'DATANODES'],
  ['datanodes.net', 'DATANODES'],
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

const normalizeDisplayDownloadLinkLabel = (value: string) => {
  return normalizeWhitespace(value).replace(/^[^A-Za-z0-9]+/, '')
}

const isReasonableHostnameLabel = (value: string) => {
  return /^[A-Za-z0-9][A-Za-z0-9-]{1,30}$/.test(value)
}

const isF95Url = (url: string) => {
  try {
    const parsedUrl = new URL(url)
    const hostname = parsedUrl.hostname.toLowerCase()
    return hostname === 'f95zone.to' || hostname.endsWith('.f95zone.to')
  } catch {
    return false
  }
}

const getDirectDownloadHostLabelFromUrl = (url: string | null) => {
  if (!url || url.includes('/masked/')) {
    return null
  }

  try {
    const parsedUrl = new URL(url)
    const hostname = parsedUrl.hostname.toLowerCase()
    if (hostname === 'f95zone.to' || hostname.endsWith('.f95zone.to')) {
      return null
    }

    const normalizedHostname = hostname.replace(/^www\./, '')
    if (normalizedHostname.includes('%')) {
      return null
    }

    for (const [domainSuffix, hostLabel] of HOST_LABEL_BY_DOMAIN_SUFFIX) {
      if (
        normalizedHostname === domainSuffix ||
        normalizedHostname.endsWith(`.${domainSuffix}`)
      ) {
        return hostLabel
      }
    }

    const hostnamePartList = normalizedHostname.split('.').filter(Boolean)
    if (hostnamePartList.length === 0) {
      return null
    }

    const fallbackHostPart =
      hostnamePartList.length > 1
        ? hostnamePartList[hostnamePartList.length - 2]
        : hostnamePartList[0]
    if (!isReasonableHostnameLabel(fallbackHostPart)) {
      return null
    }

    const normalizedHostLabel = normalizeDownloadHostLabel(fallbackHostPart)
    return normalizedHostLabel || null
  } catch {
    return null
  }
}

const resolveSupportedDownloadHostLabel = (value: string) => {
  const normalizedHostLabel = normalizeDownloadHostLabel(value)
  if (!normalizedHostLabel) {
    return null
  }

  if (SUPPORTED_DOWNLOAD_HOST_SET.has(normalizedHostLabel)) {
    return normalizedHostLabel
  }

  for (const supportedHostLabel of SUPPORTED_DOWNLOAD_HOSTS) {
    if (normalizedHostLabel.includes(supportedHostLabel)) {
      return supportedHostLabel
    }
  }

  return null
}

const getDownloadLinkHostLabel = (link: DownloadLink) => {
  const urlHostLabel = getDirectDownloadHostLabelFromUrl(link.url)
  if (urlHostLabel) {
    return urlHostLabel
  }

  const fallbackHostLabel =
    resolveSupportedDownloadHostLabel(link.label) ??
    normalizeDownloadHostLabel(normalizeDisplayDownloadLinkLabel(link.label))

  return fallbackHostLabel || null
}

const getSupportedDownloadHostLabelForLink = (link: DownloadLink) => {
  const urlHostLabel = getDirectDownloadHostLabelFromUrl(link.url)
  if (urlHostLabel) {
    return resolveSupportedDownloadHostLabel(urlHostLabel)
  }

  return resolveSupportedDownloadHostLabel(link.label)
}

const isLikelyDownloadHostLabel = (value: string) => {
  const normalizedLabel = normalizeDisplayDownloadLinkLabel(value)
  if (!normalizedLabel) {
    return false
  }

  if (NON_DOWNLOAD_LINK_LABEL_PATTERNS.some((pattern) => pattern.test(normalizedLabel))) {
    return false
  }

  if (resolveSupportedDownloadHostLabel(normalizedLabel)) {
    return true
  }

  if (normalizedLabel.includes(' ')) {
    return false
  }

  return /^[A-Za-z0-9][A-Za-z0-9+._-]{1,30}$/.test(normalizedLabel)
}

const isRelevantDownloadLink = (link: DownloadLink) => {
  if (typeof link.url === 'string') {
    if (link.isMasked) {
      return isLikelyDownloadHostLabel(link.label)
    }

    if (isF95Url(link.url)) {
      return false
    }

    return true
  }

  return isLikelyDownloadHostLabel(link.label)
}

const createDownloadLink = (
  rawLabel: string,
  url: string | null,
  isMasked: boolean,
): DownloadLink => {
  const directHostLabel = getDirectDownloadHostLabelFromUrl(url)
  const supportedHostLabel = resolveSupportedDownloadHostLabel(rawLabel)
  const displayLabel =
    directHostLabel ??
    supportedHostLabel ??
    normalizeDisplayDownloadLinkLabel(rawLabel) ??
    normalizeWhitespace(rawLabel)

  return {
    label: displayLabel || normalizeWhitespace(rawLabel),
    url,
    isMasked,
  }
}

const normalizeDownloadHostLabelList = (hostLabelList: string[]) => {
  return hostLabelList
    .map((item) => normalizeDownloadHostLabel(item))
    .filter((item, index, array) => item.length > 0 && array.indexOf(item) === index)
}

const isSupportedDownloadHost = (hostLabel: string) => {
  return resolveSupportedDownloadHostLabel(hostLabel) !== null
}

const filterSupportedDownloadHostLabels = (hostLabelList: string[]) => {
  return hostLabelList
    .map((item) => resolveSupportedDownloadHostLabel(item))
    .filter((item, index, array): item is string => {
      return item !== null && array.indexOf(item) === index
    })
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
      links: linkLabelList.map((linkLabel) =>
        createDownloadLink(linkLabel, null, false),
      ),
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
  const hasHiddenLinks =
    sectionRoot.querySelector('.messageHide--link') !== null
  let currentGroupLabel: string | null = null

  const cloneDocument = sectionRoot.ownerDocument
  const sectionClone = sectionRoot.cloneNode(true) as Element

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

  const appendGroupLink = (groupLabel: string, link: DownloadLink) => {
    const group = ensureGroup(groupLabel)
    const isAlreadyPresent = group.links.some((candidate) => {
      return candidate.label === link.label && candidate.url === link.url
    })

    if (!isAlreadyPresent) {
      group.links.push(link)
    }
  }

  const replaceWithLineBreak = (element: Element) => {
    const parentNode = element.parentNode
    if (!parentNode) {
      return
    }

    parentNode.replaceChild(cloneDocument.createTextNode('\n'), element)
  }

  for (const lineBreakElement of Array.from(sectionClone.querySelectorAll('br'))) {
    replaceWithLineBreak(lineBreakElement)
  }

  for (const blockElement of Array.from(
    sectionClone.querySelectorAll('div, p, blockquote, li'),
  )) {
    if (blockElement === sectionClone) {
      continue
    }

    const parentNode = blockElement.parentNode
    if (!parentNode) {
      continue
    }

    if (
      !blockElement.previousSibling ||
      blockElement.previousSibling.nodeType !== Node.TEXT_NODE ||
      !blockElement.previousSibling.textContent?.endsWith('\n')
    ) {
      parentNode.insertBefore(cloneDocument.createTextNode('\n'), blockElement)
    }

    if (
      !blockElement.nextSibling ||
      blockElement.nextSibling.nodeType !== Node.TEXT_NODE ||
      !blockElement.nextSibling.textContent?.startsWith('\n')
    ) {
      parentNode.insertBefore(
        cloneDocument.createTextNode('\n'),
        blockElement.nextSibling,
      )
    }
  }

  const linkTokenList: {
    token: string
    label: string
    url: string | null
    isMasked: boolean
  }[] = []
  const cloneAnchorList = Array.from(sectionClone.querySelectorAll('a'))
  cloneAnchorList.forEach((anchorElement, index) => {
    if (
      anchorElement.classList.contains('messageHide--link') ||
      anchorElement.querySelector('img.bbImage')
    ) {
      anchorElement.replaceWith(cloneDocument.createTextNode(' '))
      return
    }

    const label = normalizeWhitespace(anchorElement.textContent ?? '')
    if (!label) {
      anchorElement.replaceWith(cloneDocument.createTextNode(' '))
      return
    }

    const href = anchorElement.getAttribute('href')
    const absoluteUrl = href ? toAbsoluteUrl(href) : null
    if (absoluteUrl === `${F95_ORIGIN}/login/`) {
      anchorElement.replaceWith(cloneDocument.createTextNode(' '))
      return
    }

    const token = `__F95_DOWNLOAD_LINK_${index}__`
    linkTokenList.push({
      token,
      label,
      url: absoluteUrl,
      isMasked: Boolean(absoluteUrl?.includes('/masked/')),
    })
    anchorElement.replaceWith(cloneDocument.createTextNode(` ${token} `))
  })

  const rawLineList = (sectionClone.textContent ?? '')
    .replace(/\r/g, '')
    .replace(/\u200b/g, '')
    .split('\n')

  for (const rawLine of rawLineList) {
    const tokenMatchList = Array.from(
      rawLine.matchAll(/__F95_DOWNLOAD_LINK_(\d+)__/g),
    )
    const tokenList = tokenMatchList.map((match) => match[0])
    const plainLineText = normalizeWhitespace(
      rawLine.replace(/__F95_DOWNLOAD_LINK_(\d+)__/g, ' '),
    )

    if (tokenList.length === 0) {
      if (!plainLineText) {
        continue
      }

      const nextGroupLabelMatch = /^([^:]{1,120})\s*:\s*(.*)$/.exec(plainLineText)
      const nextGroupLabel = nextGroupLabelMatch
        ? normalizeGroupLabel(nextGroupLabelMatch[1])
        : null
      currentGroupLabel =
        nextGroupLabel && nextGroupLabel.toLowerCase() !== 'download'
          ? nextGroupLabel
          : null
      if (currentGroupLabel) {
        ensureGroup(currentGroupLabel)
      }
      continue
    }

    const nextGroupLabelMatch = /^([^:]{1,120})\s*:\s*(.*)$/.exec(plainLineText)
    const explicitGroupLabel = nextGroupLabelMatch
      ? normalizeGroupLabel(nextGroupLabelMatch[1])
      : null
    const effectiveGroupLabel =
      explicitGroupLabel && explicitGroupLabel.toLowerCase() !== 'download'
        ? explicitGroupLabel
        : currentGroupLabel

    if (!effectiveGroupLabel) {
      continue
    }

    currentGroupLabel = effectiveGroupLabel
    ensureGroup(effectiveGroupLabel)

    for (const token of tokenList) {
      const linkToken = linkTokenList.find((candidate) => candidate.token === token)
      if (!linkToken) {
        continue
      }

      appendGroupLink(
        effectiveGroupLabel,
        createDownloadLink(linkToken.label, linkToken.url, linkToken.isMasked),
      )
    }
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

const isLauncherLocalDataEnabled = () => getLauncherLocalDataSnapshotSync() !== null

const normalizeImportedStringList = (value: unknown) => {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter((item): item is string => typeof item === 'string')
}

const normalizeImportedDisabledDownloadHosts = (value: unknown) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }

  const normalizedMap: Record<string, number> = {}
  for (const [hostLabel, expiresAtUnixMs] of Object.entries(value)) {
    if (typeof hostLabel === 'string' && typeof expiresAtUnixMs === 'number') {
      normalizedMap[hostLabel] = expiresAtUnixMs
    }
  }

  return normalizedMap
}

const loadLauncherLocalSettingsBackup = () => {
  const launcherSnapshot = getLauncherLocalDataSnapshotSync()
  if (
    !launcherSnapshot ||
    !launcherSnapshot.settings ||
    typeof launcherSnapshot.settings !== 'object' ||
    Array.isArray(launcherSnapshot.settings) ||
    !('defaultSwipeSettings' in launcherSnapshot.settings)
  ) {
    return null
  }

  const rawSettings = launcherSnapshot.settings as Record<string, unknown>

  return {
    defaultSwipeSettings: normalizeDefaultSwipeSettings(rawSettings.defaultSwipeSettings),
    tagsMap: normalizeTagsMap(rawSettings.tagsMap),
    prefixesMap: normalizePrefixesMap(rawSettings.prefixesMap),
    preferredDownloadHosts: normalizeImportedStringList(
      rawSettings.preferredDownloadHosts,
    ),
    disabledDownloadHosts: normalizeImportedDisabledDownloadHosts(
      rawSettings.disabledDownloadHosts,
    ),
    hiddenDownloadHosts: normalizeImportedStringList(rawSettings.hiddenDownloadHosts),
    cookieProxy: 'cookieProxy' in rawSettings ? rawSettings.cookieProxy : null,
  }
}

const loadPreferredDownloadHostsFromLocalStorage = () => {
  try {
    const rawValue = localStorage.getItem(DOWNLOAD_HOST_PREFERENCES_KEY)
    if (!rawValue) {
      return [...DEFAULT_PREFERRED_DOWNLOAD_HOSTS]
    }

    const parsedValue = safeJsonParse<unknown>(rawValue)
    if (!Array.isArray(parsedValue)) {
      return [...DEFAULT_PREFERRED_DOWNLOAD_HOSTS]
    }

    const normalizedHostList = filterSupportedDownloadHostLabels(
      parsedValue.filter((item): item is string => typeof item === 'string'),
    )

    return normalizedHostList.length > 0
      ? normalizedHostList
      : [...DEFAULT_PREFERRED_DOWNLOAD_HOSTS]
  } catch {
    return [...DEFAULT_PREFERRED_DOWNLOAD_HOSTS]
  }
}

const loadHiddenDownloadHostsFromLocalStorage = () => {
  try {
    const rawValue = localStorage.getItem(HIDDEN_DOWNLOAD_HOSTS_KEY)
    if (!rawValue) {
      return []
    }

    const parsedValue = safeJsonParse<unknown>(rawValue)
    if (!Array.isArray(parsedValue)) {
      return []
    }

    return filterSupportedDownloadHostLabels(
      parsedValue.filter((item): item is string => typeof item === 'string'),
    )
  } catch {
    return []
  }
}

const loadDisabledDownloadHostsFromLocalStorage = () => {
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

    return pruneDisabledDownloadHosts(nextDisabledHostMap)
  } catch {
    return {}
  }
}

const buildFallbackLocalSettingsBackup = () => ({
  defaultSwipeSettings: loadDefaultSwipeSettings(),
  tagsMap: loadTagsMap(),
  prefixesMap: loadPrefixesMap(),
  preferredDownloadHosts: loadPreferredDownloadHostsFromLocalStorage(),
  disabledDownloadHosts: loadDisabledDownloadHostsFromLocalStorage(),
  hiddenDownloadHosts: loadHiddenDownloadHostsFromLocalStorage(),
  cookieProxy: null,
})

const saveLauncherLocalSettingsBackup = (
  patch: Partial<ReturnType<typeof buildFallbackLocalSettingsBackup>>,
) => {
  const currentSettingsBackup =
    loadLauncherLocalSettingsBackup() ?? buildFallbackLocalSettingsBackup()
  saveLauncherLocalSettingsSync({
    ...currentSettingsBackup,
    ...patch,
  })
}

const loadPreferredDownloadHosts = () => {
  const launcherSettingsBackup = loadLauncherLocalSettingsBackup()
  if (launcherSettingsBackup) {
    const normalizedHostList = filterSupportedDownloadHostLabels(
      launcherSettingsBackup.preferredDownloadHosts,
    )
    return normalizedHostList.length > 0
      ? normalizedHostList
      : [...DEFAULT_PREFERRED_DOWNLOAD_HOSTS]
  }

  return loadPreferredDownloadHostsFromLocalStorage()
}

const savePreferredDownloadHosts = (hostLabelList: string[]) => {
  const normalizedHostList = filterSupportedDownloadHostLabels(hostLabelList)

  if (isLauncherLocalDataEnabled()) {
    saveLauncherLocalSettingsBackup({
      preferredDownloadHosts: normalizedHostList,
    })
    return
  }

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
  if (isLauncherLocalDataEnabled()) {
    saveLauncherLocalSettingsBackup({
      preferredDownloadHosts: [...DEFAULT_PREFERRED_DOWNLOAD_HOSTS],
    })
    return [...DEFAULT_PREFERRED_DOWNLOAD_HOSTS]
  }

  try {
    localStorage.removeItem(DOWNLOAD_HOST_PREFERENCES_KEY)
  } catch {
    // ignore
  }

  return [...DEFAULT_PREFERRED_DOWNLOAD_HOSTS]
}

const loadHiddenDownloadHosts = () => {
  const launcherSettingsBackup = loadLauncherLocalSettingsBackup()
  if (launcherSettingsBackup) {
    return filterSupportedDownloadHostLabels(launcherSettingsBackup.hiddenDownloadHosts)
  }

  return loadHiddenDownloadHostsFromLocalStorage()
}

const saveHiddenDownloadHosts = (hostLabelList: string[]) => {
  const normalizedHostList = filterSupportedDownloadHostLabels(hostLabelList)

  if (isLauncherLocalDataEnabled()) {
    saveLauncherLocalSettingsBackup({
      hiddenDownloadHosts: normalizedHostList,
    })
    return
  }

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
  if (!normalizedHostLabel || !isSupportedDownloadHost(normalizedHostLabel)) {
    return loadHiddenDownloadHosts()
  }

  const nextHiddenHostList = filterSupportedDownloadHostLabels([
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
  if (isLauncherLocalDataEnabled()) {
    saveLauncherLocalSettingsBackup({
      hiddenDownloadHosts: [],
    })
    return
  }

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

    const normalizedHostLabel = normalizeDownloadHostLabel(hostLabel)
    if (!SUPPORTED_DOWNLOAD_HOST_SET.has(normalizedHostLabel)) {
      continue
    }

    nextDisabledHostMap[normalizedHostLabel] = expiresAtUnixMs
  }

  return nextDisabledHostMap
}

const saveDisabledDownloadHosts = (disabledHostMap: Record<string, number>) => {
  const prunedDisabledHostMap = pruneDisabledDownloadHosts(disabledHostMap)

  if (isLauncherLocalDataEnabled()) {
    saveLauncherLocalSettingsBackup({
      disabledDownloadHosts: prunedDisabledHostMap,
    })
    return
  }

  try {
    localStorage.setItem(
      DISABLED_DOWNLOAD_HOSTS_KEY,
      JSON.stringify(prunedDisabledHostMap),
    )
  } catch {
    // ignore
  }
}

const loadDisabledDownloadHosts = () => {
  const launcherSettingsBackup = loadLauncherLocalSettingsBackup()
  if (launcherSettingsBackup) {
    const prunedDisabledHostMap = pruneDisabledDownloadHosts(
      launcherSettingsBackup.disabledDownloadHosts,
    )
    if (
      Object.keys(prunedDisabledHostMap).length !==
      Object.keys(launcherSettingsBackup.disabledDownloadHosts).length
    ) {
      saveDisabledDownloadHosts(prunedDisabledHostMap)
    }

    return prunedDisabledHostMap
  }

  return loadDisabledDownloadHostsFromLocalStorage()
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
  if (!normalizedHostLabel || !isSupportedDownloadHost(normalizedHostLabel)) {
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
  if (isLauncherLocalDataEnabled()) {
    saveLauncherLocalSettingsBackup({
      disabledDownloadHosts: {},
    })
    return
  }

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
  if (!normalizedPrimaryHostLabel || !isSupportedDownloadHost(normalizedPrimaryHostLabel)) {
    return filterSupportedDownloadHostLabels(currentHostLabelList)
  }

  const normalizedCurrentHostList = filterSupportedDownloadHostLabels(
    currentHostLabelList,
  )

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
  const normalizedCurrentHostList = filterSupportedDownloadHostLabels(
    currentHostLabelList,
  )
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
  const normalizedPreferredHostList = filterSupportedDownloadHostLabels(
    preferredHostLabelList,
  )

  return filterSupportedDownloadHostLabels(hostLabelList).sort((first, second) => {
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

const collectDownloadChoices = (threadDownloadsData: ThreadDownloadsData): DownloadChoice[] => {
  const choiceList: DownloadChoice[] = []
  let pendingContextLabel: string | null = null

  for (const group of threadDownloadsData.groups) {
    if (shouldHideDownloadGroup(group.label)) {
      continue
    }

    if (group.links.length === 0) {
      pendingContextLabel = group.label
      continue
    }

    const relevantLinkList = group.links.filter((link) => isRelevantDownloadLink(link))
    if (relevantLinkList.length === 0) {
      continue
    }

    const deduplicatedLinkList = relevantLinkList.filter((link, index, array) => {
      const currentKey = `${link.label}::${link.url ?? ''}`
      return (
        array.findIndex((candidate) => {
          return `${candidate.label}::${candidate.url ?? ''}` === currentKey
        }) === index
      )
    })

    choiceList.push({
      key: `${pendingContextLabel ?? ''}::${group.label}::${choiceList.length}`,
      label: group.label,
      contextLabel: pendingContextLabel,
      links: deduplicatedLinkList,
    })

    pendingContextLabel = null
  }

  return choiceList
}

const collectPreferredDownloadLinksFromLinks = (
  linkList: DownloadLink[],
  preferredHostLabelList: string[],
  disabledHostMap: Record<string, number> = {},
  hiddenHostLabelList: string[] = [],
) => {
  const normalizedPreferredHostList = preferredHostLabelList
    .map((item) => resolveSupportedDownloadHostLabel(item))
    .filter((item): item is string => item !== null)
  const linkByHostLabel = new Map<string, DownloadLink>()

  for (const link of linkList) {
    if (typeof link.url !== 'string') {
      continue
    }

    const supportedHostLabel = getSupportedDownloadHostLabelForLink(link)
    if (
      !supportedHostLabel ||
      isDownloadHostTemporarilyDisabled(supportedHostLabel, disabledHostMap) ||
      isDownloadHostHidden(supportedHostLabel, hiddenHostLabelList)
    ) {
      continue
    }

    if (!linkByHostLabel.has(supportedHostLabel)) {
      linkByHostLabel.set(supportedHostLabel, {
        ...link,
        label: supportedHostLabel,
      })
    }
  }

  return Array.from(linkByHostLabel.entries())
    .sort(([firstHostLabel], [secondHostLabel]) => {
      const firstIndex = normalizedPreferredHostList.indexOf(firstHostLabel)
      const secondIndex = normalizedPreferredHostList.indexOf(secondHostLabel)

      const firstRank = firstIndex === -1 ? Number.MAX_SAFE_INTEGER : firstIndex
      const secondRank = secondIndex === -1 ? Number.MAX_SAFE_INTEGER : secondIndex

      if (firstRank !== secondRank) {
        return firstRank - secondRank
      }

      return firstHostLabel.localeCompare(secondHostLabel)
    })
    .map(([, link]) => link)
}

const collectDownloadHostLabels = (threadDownloadsData: ThreadDownloadsData) => {
  const hostLabelList: string[] = []

  for (const choice of collectDownloadChoices(threadDownloadsData)) {
    for (const link of choice.links) {
      const supportedHostLabel = getSupportedDownloadHostLabelForLink(link)
      if (!supportedHostLabel || hostLabelList.includes(supportedHostLabel)) {
        continue
      }

      hostLabelList.push(supportedHostLabel)
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
  for (const choice of collectDownloadChoices(threadDownloadsData)) {
    const availableLinkList = collectPreferredDownloadLinksFromLinks(
      choice.links,
      preferredHostLabelList,
      disabledHostMap,
      hiddenHostLabelList,
    )
    if (availableLinkList.length > 0) {
      return availableLinkList[0] ?? null
    }
  }

  return null
}

const collectPreferredDownloadLinks = (
  threadDownloadsData: ThreadDownloadsData,
  preferredHostLabelList: string[],
  disabledHostMap: Record<string, number> = {},
  hiddenHostLabelList: string[] = [],
) => {
  const flattenedLinkList = collectDownloadChoices(threadDownloadsData).flatMap(
    (choice) => choice.links,
  )

  return collectPreferredDownloadLinksFromLinks(
    flattenedLinkList,
    preferredHostLabelList,
    disabledHostMap,
    hiddenHostLabelList,
  )
}

const fetchThreadDownloadsFromNetwork = async (
  threadLink: string,
  abortSignal?: AbortSignal,
) => {
  const launcherHtmlText = await fetchThreadPageHtmlViaLauncher(threadLink)
  if (launcherHtmlText !== null) {
    return parseThreadDownloadsFromHtml(launcherHtmlText, threadLink)
  }

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
  collectDownloadChoices,
  clearAllCachedThreadDownloads,
  collectPreferredDownloadLinksFromLinks,
  collectPreferredDownloadLinks,
  collectDownloadHostLabels,
  disableDownloadHostTemporarily,
  enableDownloadHost,
  fetchThreadDownloads,
  findBestDownloadLink,
  getDownloadLinkHostLabel,
  getSupportedDownloadHostLabelForLink,
  hideDownloadHost,
  isDownloadHostHidden,
  isRelevantDownloadLink,
  isSupportedDownloadHost,
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
  saveDisabledDownloadHosts,
  saveHiddenDownloadHosts,
  savePreferredDownloadHosts,
  showDownloadHost,
  SUPPORTED_DOWNLOAD_HOSTS,
  shouldHideDownloadGroup,
  sortDownloadHostsByPreference,
  TEMPORARY_DISABLED_HOST_DURATION_MS,
}
