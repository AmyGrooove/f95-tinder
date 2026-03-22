import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  DefaultSwipeSettings,
  F95ThreadItem,
  FilterState,
  LatestGamesSort,
  SessionState,
  UndoSnapshot,
  ListType,
  ProcessedThreadItem,
  MetadataSyncState,
} from './types'
import { buildThreadLink, fetchLatestGamesPage } from './api'
import {
  createDefaultSessionState,
  loadCachedPage,
  loadDefaultSwipeSettings,
  loadSessionState,
  markPageAsCached,
  pruneCachedPages,
  saveCachedPage,
  saveDefaultSwipeSettings,
  saveSessionState,
  clearAllStoredData,
  DEFAULT_FILTER_STATE,
  loadPrefixesMap,
  loadTagsMap,
  savePrefixesMap,
  saveTagsMap,
} from './storage'
import { normalizeFilterState, threadMatchesFilter } from './filtering'
import {
  isUpdateTrackedListType,
} from './updateTracking'
import { mergeUniqueStringArrays, removeStringFromArray } from './utils'

const MAX_CACHED_PAGES_COUNT = 15
const PREFETCH_THRESHOLD_REMAINING_COUNT = 5
const AUTO_METADATA_SYNC_ENABLED = false

type ActionType = ListType

const parseThreadIdentifierFromLink = (threadLink: string) => {
  const match = /\/threads\/(\d+)/.exec(threadLink)
  if (!match) {
    return null
  }
  return Number(match[1])
}

const toUnixSeconds = () => Math.floor(Date.now() / 1000)

const resolveTrackedSnapshot = (
  listType: ListType | null,
  version: string,
  ts: number | undefined,
  existingItem: ProcessedThreadItem | undefined,
) => {
  const fallbackTrackedVersion =
    typeof existingItem?.trackedVersion === 'string'
      ? existingItem.trackedVersion
      : version
  const fallbackTrackedTs =
    typeof existingItem?.trackedTs === 'number' ? existingItem.trackedTs : ts

  if (!isUpdateTrackedListType(listType)) {
    return {
      trackedVersion: fallbackTrackedVersion,
      trackedTs: fallbackTrackedTs,
    }
  }

  const wasTrackedBefore = isUpdateTrackedListType(existingItem?.listType)
  if (!wasTrackedBefore) {
    return {
      trackedVersion: version,
      trackedTs: ts,
    }
  }

  return {
    trackedVersion: fallbackTrackedVersion,
    trackedTs: fallbackTrackedTs,
  }
}

const buildProcessedThreadItem = (
  threadLink: string,
  listType: ListType | null,
  threadItem: F95ThreadItem | null,
  existingItem: ProcessedThreadItem | undefined,
) => {
  const parsedIdentifier = parseThreadIdentifierFromLink(threadLink)
  const threadIdentifier =
    existingItem?.threadIdentifier ??
    (parsedIdentifier !== null ? parsedIdentifier : 0)

  const fallbackTitle =
    threadItem?.title ??
    existingItem?.title ??
    `Thread ${threadIdentifier}`
  const fallbackCreator = threadItem?.creator ?? existingItem?.creator ?? 'Unknown'

  const cover = threadItem?.cover ?? existingItem?.cover ?? ''
  const rating =
    typeof threadItem?.rating === 'number'
      ? threadItem.rating
      : existingItem?.rating ?? 0
  const version = threadItem?.version ?? existingItem?.version ?? ''

  const tags =
    Array.isArray(threadItem?.tags)
      ? threadItem.tags.filter((tag) => typeof tag === 'number')
      : Array.isArray(existingItem?.tags)
      ? existingItem.tags.filter((tag) => typeof tag === 'number')
      : []

  const ts =
    typeof threadItem?.ts === 'number'
      ? threadItem.ts
      : existingItem?.ts
  const { trackedVersion, trackedTs } = resolveTrackedSnapshot(
    listType,
    version,
    ts,
    existingItem,
  )

  const addedAtUnixSeconds =
    existingItem?.addedAtUnixSeconds ?? toUnixSeconds()

  return {
    threadIdentifier,
    threadLink,
    title: fallbackTitle,
    creator: fallbackCreator,
    cover,
    rating,
    trackedVersion,
    version,
    tags,
    trackedTs,
    ts,
    addedAtUnixSeconds,
    listType,
  }
}

const getPlayedLinks = (state: SessionState) => {
  return state.playedLinks ?? []
}

const isProcessedItemMissingMetadata = (
  processedItem: ProcessedThreadItem | undefined,
) => {
  if (!processedItem) {
    return true
  }

  const hasFallbackTitle = /^Thread \d+$/.test(processedItem.title)
  return (
    hasFallbackTitle ||
    processedItem.creator === 'Unknown' ||
    !processedItem.cover ||
    processedItem.tags.length === 0
  )
}

const collectMetadataSyncCandidateLinks = (sessionState: SessionState) => {
  const trackedLinkSet = new Set<string>([
    ...sessionState.favoritesLinks,
    ...sessionState.trashLinks,
    ...getPlayedLinks(sessionState),
  ])

  return Array.from(trackedLinkSet).filter((threadLink) =>
    isProcessedItemMissingMetadata(
      sessionState.processedThreadItemsByLink[threadLink],
    ),
  )
}

const collectUpdateTrackerCandidateLinks = (sessionState: SessionState) => {
  return Array.from(
    new Set<string>([
      ...sessionState.favoritesLinks,
      ...getPlayedLinks(sessionState),
    ]),
  )
}

const collectSyncCandidateLinks = (sessionState: SessionState) => {
  return Array.from(
    new Set<string>([
      ...collectMetadataSyncCandidateLinks(sessionState),
      ...collectUpdateTrackerCandidateLinks(sessionState),
    ]),
  )
}

const isThreadLinkTrackedInDashboard = (
  sessionState: SessionState,
  threadLink: string,
) => {
  return (
    sessionState.favoritesLinks.includes(threadLink) ||
    sessionState.trashLinks.includes(threadLink) ||
    getPlayedLinks(sessionState).includes(threadLink)
  )
}

const sanitizeSwipeQueue = (sessionState: SessionState) => {
  const trackedLinkSet = new Set<string>([
    ...sessionState.favoritesLinks,
    ...sessionState.trashLinks,
    ...getPlayedLinks(sessionState),
  ])

  const nextRemainingThreadIdentifiers = sessionState.remainingThreadIdentifiers.filter(
    (threadIdentifier) => !trackedLinkSet.has(buildThreadLink(threadIdentifier)),
  )

  if (
    nextRemainingThreadIdentifiers.length ===
    sessionState.remainingThreadIdentifiers.length
  ) {
    return sessionState
  }

  return {
    ...sessionState,
    remainingThreadIdentifiers: nextRemainingThreadIdentifiers,
  }
}

const createSavedDefaultSwipeSettings = (
  defaultSwipeSettings: DefaultSwipeSettings,
): DefaultSwipeSettings => {
  return {
    latestGamesSort:
      defaultSwipeSettings.latestGamesSort === 'views' ? 'views' : 'date',
    filterState: normalizeFilterState({
      ...DEFAULT_FILTER_STATE,
      ...defaultSwipeSettings.filterState,
    }),
  }
}

const pickCurrentThreadIdentifier = (sessionState: SessionState) => {
  for (const threadIdentifier of sessionState.remainingThreadIdentifiers) {
    const threadItem = sessionState.threadItemsByIdentifier[String(threadIdentifier)]
    if (!threadItem) {
      continue
    }

    const threadLink = buildThreadLink(threadIdentifier)
    if (isThreadLinkTrackedInDashboard(sessionState, threadLink)) {
      continue
    }

    if (threadMatchesFilter(threadItem, sessionState.filterState)) {
      return threadIdentifier
    }
  }

  return null
}

const appendPageToSessionState = (sessionState: SessionState, threadItemList: F95ThreadItem[]) => {
  const existingThreadIdentifierSet = new Set<number>()

  for (const threadIdentifier of sessionState.remainingThreadIdentifiers) {
    existingThreadIdentifierSet.add(threadIdentifier)
  }

  const favoritesLinkSet = new Set<string>(sessionState.favoritesLinks)
  const trashLinkSet = new Set<string>(sessionState.trashLinks)
  const playedLinkSet = new Set<string>(sessionState.playedLinks ?? [])

  const updatedThreadItemsByIdentifier = { ...sessionState.threadItemsByIdentifier }
  const updatedRemainingThreadIdentifiers = [...sessionState.remainingThreadIdentifiers]

  for (const threadItem of threadItemList) {
    const threadIdentifier = threadItem.thread_id
    const threadLink = buildThreadLink(threadIdentifier)

    updatedThreadItemsByIdentifier[String(threadIdentifier)] = threadItem

    const isAlreadyInQueue = existingThreadIdentifierSet.has(threadIdentifier)
    const isAlreadyProcessed =
      favoritesLinkSet.has(threadLink) ||
      trashLinkSet.has(threadLink) ||
      playedLinkSet.has(threadLink)

    if (!isAlreadyInQueue && !isAlreadyProcessed) {
      updatedRemainingThreadIdentifiers.push(threadIdentifier)
      existingThreadIdentifierSet.add(threadIdentifier)
    }
  }

  return {
    ...sessionState,
    threadItemsByIdentifier: updatedThreadItemsByIdentifier,
    remainingThreadIdentifiers: updatedRemainingThreadIdentifiers,
  }
}

const isAbortError = (unknownError: unknown) => {
  if (!unknownError || typeof unknownError !== 'object') {
    return false
  }

  const possibleName = (unknownError as { name?: unknown }).name
  return possibleName === 'AbortError'
}

const useF95Browser = () => {
  const sessionStateRef = useRef<SessionState | null>(null)
  const defaultSwipeSettingsRef = useRef<DefaultSwipeSettings>(
    createSavedDefaultSwipeSettings(loadDefaultSwipeSettings()),
  )
  const [defaultSwipeSettings, setDefaultSwipeSettings] =
    useState<DefaultSwipeSettings>(() => defaultSwipeSettingsRef.current)
  const defaultFilterState = defaultSwipeSettings.filterState
  const defaultLatestGamesSort = defaultSwipeSettings.latestGamesSort
  const [sessionState, setSessionState] = useState<SessionState>(() => {
    const loadedSessionState = loadSessionState()
    const initialState = sanitizeSwipeQueue(
      loadedSessionState ??
        createDefaultSessionState(defaultSwipeSettingsRef.current),
    )
    sessionStateRef.current = initialState
    return initialState
  })

  const [undoSnapshot, setUndoSnapshot] = useState<UndoSnapshot | null>(null)
  const [isLoadingPage, setIsLoadingPage] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [tagsMap, setTagsMapState] = useState<Record<string, string>>(() => loadTagsMap())
  const [prefixesMap, setPrefixesMapState] = useState<Record<string, string>>(() =>
    loadPrefixesMap(),
  )
  const [metadataSyncState, setMetadataSyncState] = useState<MetadataSyncState>({
    isRunning: false,
    currentPage: 0,
    pageLimit: 0,
    syncedCount: 0,
    trackedCount: 0,
    error: null,
  })
  const lastAutoMetadataSyncSignatureRef = useRef<string | null>(null)

  const currentThreadIdentifier = useMemo(() => pickCurrentThreadIdentifier(sessionState), [sessionState])
  const currentThreadItem = useMemo(() => {
    if (currentThreadIdentifier === null) {
      return null
    }
    return sessionState.threadItemsByIdentifier[String(currentThreadIdentifier)] ?? null
  }, [currentThreadIdentifier, sessionState.threadItemsByIdentifier])

  const persistSessionState = useCallback((nextSessionState: SessionState) => {
    const sanitizedSessionState = sanitizeSwipeQueue(nextSessionState)
    sessionStateRef.current = sanitizedSessionState
    setSessionState(sanitizedSessionState)
    saveSessionState(sanitizedSessionState)
  }, [])

  const persistDefaultSwipeSettings = useCallback((nextDefaultSwipeSettings: DefaultSwipeSettings) => {
    const sanitizedDefaultSwipeSettings =
      createSavedDefaultSwipeSettings(nextDefaultSwipeSettings)
    defaultSwipeSettingsRef.current = sanitizedDefaultSwipeSettings
    setDefaultSwipeSettings(sanitizedDefaultSwipeSettings)
    saveDefaultSwipeSettings(sanitizedDefaultSwipeSettings)
  }, [])

  const loadPage = useCallback(
    async (pageNumber: number, latestGamesSort: LatestGamesSort) => {
      setErrorMessage(null)

      const cachedThreadItemList = loadCachedPage(latestGamesSort, pageNumber)
      if (cachedThreadItemList) {
        return { threadItemList: cachedThreadItemList, totalPages: 0, pageFromResponse: pageNumber }
      }

      const abortController = new AbortController()

      const result = await fetchLatestGamesPage(
        pageNumber,
        abortController.signal,
        latestGamesSort,
      )
      saveCachedPage(latestGamesSort, pageNumber, result.threadItemList)
      markPageAsCached(latestGamesSort, pageNumber)
      pruneCachedPages(latestGamesSort, MAX_CACHED_PAGES_COUNT)

      return result
    },
    [],
  )

  const ensureInitialData = useCallback(async () => {
    const hasAnyData =
      sessionState.remainingThreadIdentifiers.length > 0 || Object.keys(sessionState.threadItemsByIdentifier).length > 0

    if (hasAnyData) {
      return
    }

    setIsLoadingPage(true)
    try {
      const startPageNumber = 1
      const latestGamesSort = sessionState.latestGamesSort
      const pageResult = await loadPage(startPageNumber, latestGamesSort)
      const liveSessionState = sessionStateRef.current

      if (
        !liveSessionState ||
        liveSessionState.latestGamesSort !== latestGamesSort ||
        liveSessionState.nextPageToFetchNumber !== startPageNumber
      ) {
        return
      }

      const nextSessionStateAfterPage = appendPageToSessionState(
        {
          ...liveSessionState,
          currentPageNumber: startPageNumber,
          nextPageToFetchNumber: startPageNumber + 1,
        },
        pageResult.threadItemList,
      )

      persistSessionState(nextSessionStateAfterPage)
    } catch (error) {
      if (!isAbortError(error)) {
        setErrorMessage(error instanceof Error ? error.message : 'Unknown error')
      }
    } finally {
      setIsLoadingPage(false)
    }
  }, [loadPage, persistSessionState, sessionState])

  useEffect(() => {
    void ensureInitialData()
  }, [ensureInitialData])

  const prefetchNextPageIfNeeded = useCallback(async () => {
    if (isLoadingPage) {
      return
    }

    if (Object.keys(sessionState.threadItemsByIdentifier).length === 0) {
      return
    }

    if (sessionState.remainingThreadIdentifiers.length > PREFETCH_THRESHOLD_REMAINING_COUNT) {
      return
    }

    const nextPageNumber = sessionState.nextPageToFetchNumber
    if (nextPageNumber < 1) {
      return
    }

    setIsLoadingPage(true)
    try {
      const latestGamesSort = sessionState.latestGamesSort
      const pageResult = await loadPage(nextPageNumber, latestGamesSort)
      const liveSessionState = sessionStateRef.current

      if (
        !liveSessionState ||
        liveSessionState.latestGamesSort !== latestGamesSort ||
        liveSessionState.nextPageToFetchNumber !== nextPageNumber
      ) {
        return
      }

      const nextSessionStateAfterPage = appendPageToSessionState(
        {
          ...liveSessionState,
          currentPageNumber: nextPageNumber,
          nextPageToFetchNumber: nextPageNumber + 1,
        },
        pageResult.threadItemList,
      )

      persistSessionState(nextSessionStateAfterPage)
    } catch (error) {
      if (!isAbortError(error)) {
        setErrorMessage(error instanceof Error ? error.message : 'Unknown error')
      }
    } finally {
      setIsLoadingPage(false)
    }
  }, [isLoadingPage, loadPage, persistSessionState, sessionState])

  useEffect(() => {
    void prefetchNextPageIfNeeded()
  }, [prefetchNextPageIfNeeded, sessionState.remainingThreadIdentifiers.length])

  const applyActionToCurrentCard = useCallback(
    (actionType: ActionType) => {
      if (currentThreadIdentifier === null) {
        return
      }

      const currentThreadIdentifierIndex = sessionState.remainingThreadIdentifiers.findIndex(
        (threadIdentifier) => threadIdentifier === currentThreadIdentifier,
      )

      if (currentThreadIdentifierIndex < 0) {
        return
      }

      setUndoSnapshot({ sessionStateBefore: sessionState })

      const threadLink = buildThreadLink(currentThreadIdentifier)
      const threadItem = sessionState.threadItemsByIdentifier[String(currentThreadIdentifier)]

      const remainingThreadIdentifiersAfterAction = [...sessionState.remainingThreadIdentifiers]
      remainingThreadIdentifiersAfterAction.splice(currentThreadIdentifierIndex, 1)

      const favoritesLinksNext =
        actionType === 'favorite'
          ? mergeUniqueStringArrays(sessionState.favoritesLinks, [threadLink])
          : removeStringFromArray(sessionState.favoritesLinks, threadLink)

      const trashLinksNext =
        actionType === 'trash'
          ? mergeUniqueStringArrays(sessionState.trashLinks, [threadLink])
          : removeStringFromArray(sessionState.trashLinks, threadLink)

      const playedLinksNext =
        actionType === 'played'
          ? mergeUniqueStringArrays(sessionState.playedLinks, [threadLink])
          : removeStringFromArray(sessionState.playedLinks, threadLink)

      const playedByLinkNext = { ...sessionState.playedByLink }
      if (actionType === 'played') {
        playedByLinkNext[threadLink] = true
      } else {
        delete playedByLinkNext[threadLink]
      }

      const processedThreadItemsByLinkNext: Record<string, ProcessedThreadItem> = {
        ...sessionState.processedThreadItemsByLink,
      }

      const processedItem = buildProcessedThreadItem(
        threadLink,
        actionType,
        threadItem,
        processedThreadItemsByLinkNext[threadLink],
      )

      processedThreadItemsByLinkNext[threadLink] = processedItem

      const nextSessionState: SessionState = {
        ...sessionState,
        remainingThreadIdentifiers: remainingThreadIdentifiersAfterAction,
        favoritesLinks: favoritesLinksNext,
        trashLinks: trashLinksNext,
        playedLinks: playedLinksNext,
        playedByLink: playedByLinkNext,
        processedThreadItemsByLink: processedThreadItemsByLinkNext,
        viewedCount: sessionState.viewedCount + 1,
      }

      persistSessionState(nextSessionState)
    },
    [currentThreadIdentifier, persistSessionState, sessionState],
  )

  const undoLastAction = useCallback(() => {
    if (!undoSnapshot) {
      return
    }

    persistSessionState(undoSnapshot.sessionStateBefore)
    setUndoSnapshot(null)
  }, [persistSessionState, undoSnapshot])

  const updateFilterState = useCallback(
    (partialFilterState: Partial<FilterState>) => {
      const nextSessionState: SessionState = {
        ...sessionState,
        filterState: normalizeFilterState({
          ...sessionState.filterState,
          ...partialFilterState,
        }),
      }
      persistSessionState(nextSessionState)
    },
    [persistSessionState, sessionState],
  )

  const setLatestGamesSort = useCallback(
    (latestGamesSort: LatestGamesSort) => {
      const liveSessionState = sessionStateRef.current
      if (
        !liveSessionState ||
        liveSessionState.latestGamesSort === latestGamesSort
      ) {
        return
      }

      setUndoSnapshot(null)
      setErrorMessage(null)
      persistSessionState({
        ...liveSessionState,
        latestGamesSort,
        currentPageNumber: 1,
        nextPageToFetchNumber: 1,
        remainingThreadIdentifiers: [],
        threadItemsByIdentifier: {},
      })
    },
    [persistSessionState],
  )

  const resetFilterState = useCallback(() => {
    const nextSessionState: SessionState = {
      ...sessionState,
      latestGamesSort: defaultSwipeSettingsRef.current.latestGamesSort,
      filterState: { ...defaultSwipeSettingsRef.current.filterState },
    }
    persistSessionState(nextSessionState)
  }, [persistSessionState, sessionState])

  const updateDefaultFilterState = useCallback(
    (partialFilterState: Partial<FilterState>) => {
      persistDefaultSwipeSettings({
        ...defaultSwipeSettingsRef.current,
        filterState: {
          ...defaultSwipeSettingsRef.current.filterState,
          ...partialFilterState,
        },
      })
    },
    [persistDefaultSwipeSettings],
  )

  const updateDefaultLatestGamesSort = useCallback(
    (latestGamesSort: LatestGamesSort) => {
      persistDefaultSwipeSettings({
        ...defaultSwipeSettingsRef.current,
        latestGamesSort,
      })
    },
    [persistDefaultSwipeSettings],
  )

  const replaceDefaultSwipeSettings = useCallback(
    (nextDefaultSwipeSettings: DefaultSwipeSettings) => {
      persistDefaultSwipeSettings(nextDefaultSwipeSettings)
    },
    [persistDefaultSwipeSettings],
  )

  const resetDefaultFilterState = useCallback(() => {
    persistDefaultSwipeSettings({
      latestGamesSort: 'date',
      filterState: { ...DEFAULT_FILTER_STATE },
    })
  }, [persistDefaultSwipeSettings])

  const saveCurrentFilterStateAsDefault = useCallback(() => {
    persistDefaultSwipeSettings({
      latestGamesSort: sessionState.latestGamesSort,
      filterState: sessionState.filterState,
    })
  }, [persistDefaultSwipeSettings, sessionState.filterState, sessionState.latestGamesSort])

  const applyDefaultFilterStateToSwipe = useCallback(() => {
    const nextSessionState: SessionState = {
      ...sessionState,
      latestGamesSort: defaultSwipeSettingsRef.current.latestGamesSort,
      filterState: { ...defaultSwipeSettingsRef.current.filterState },
    }
    persistSessionState(nextSessionState)
  }, [persistSessionState, sessionState])

  const clearAllData = useCallback(() => {
    clearAllStoredData()
    setUndoSnapshot(null)
    setErrorMessage(null)
    setIsLoadingPage(false)
    setTagsMapState({})
    setPrefixesMapState({})
    setMetadataSyncState({
      isRunning: false,
      currentPage: 0,
      pageLimit: 0,
      syncedCount: 0,
      trackedCount: 0,
      error: null,
    })
    const nextBuiltInDefaultSwipeSettings = createSavedDefaultSwipeSettings(
      loadDefaultSwipeSettings(),
    )
    const nextState = createDefaultSessionState(nextBuiltInDefaultSwipeSettings)
    defaultSwipeSettingsRef.current = nextBuiltInDefaultSwipeSettings
    setDefaultSwipeSettings(nextBuiltInDefaultSwipeSettings)
    persistSessionState(nextState)
  }, [persistSessionState])

  const clearDashboardLists = useCallback(() => {
    const trackedLinkSet = new Set([
      ...sessionState.favoritesLinks,
      ...sessionState.trashLinks,
      ...sessionState.playedLinks,
    ])
    const nextProcessedThreadItems = {
      ...sessionState.processedThreadItemsByLink,
    }

    for (const threadLink of trackedLinkSet) {
      delete nextProcessedThreadItems[threadLink]
    }

    setUndoSnapshot(null)
    persistSessionState({
      ...sessionState,
      favoritesLinks: [],
      trashLinks: [],
      playedLinks: [],
      playedByLink: {},
      processedThreadItemsByLink: nextProcessedThreadItems,
    })
  }, [persistSessionState, sessionState])

  const moveLinkToList = useCallback(
    (threadLink: string, targetList: ListType) => {
      const favoritesLinks =
        targetList === 'favorite'
          ? mergeUniqueStringArrays(sessionState.favoritesLinks, [threadLink])
          : removeStringFromArray(sessionState.favoritesLinks, threadLink)

      const trashLinks =
        targetList === 'trash'
          ? mergeUniqueStringArrays(sessionState.trashLinks, [threadLink])
          : removeStringFromArray(sessionState.trashLinks, threadLink)

      const playedLinks =
        targetList === 'played'
          ? mergeUniqueStringArrays(sessionState.playedLinks, [threadLink])
          : removeStringFromArray(sessionState.playedLinks, threadLink)

      const playedByLink = { ...sessionState.playedByLink }
      if (targetList === 'played') {
        playedByLink[threadLink] = true
      } else {
        delete playedByLink[threadLink]
      }

      const threadIdentifier = parseThreadIdentifierFromLink(threadLink)
      const threadItem =
        threadIdentifier !== null
          ? sessionState.threadItemsByIdentifier[String(threadIdentifier)]
          : null

      const nextProcessedThreadItems = {
        ...sessionState.processedThreadItemsByLink,
      }

      nextProcessedThreadItems[threadLink] = buildProcessedThreadItem(
        threadLink,
        targetList,
        threadItem,
        sessionState.processedThreadItemsByLink[threadLink],
      )

      persistSessionState({
        ...sessionState,
        favoritesLinks,
        trashLinks,
        playedLinks,
        playedByLink,
        processedThreadItemsByLink: nextProcessedThreadItems,
      })
    },
    [sessionState, persistSessionState],
  )

  const removeLinkFromList = useCallback(
    (threadLink: string, listType: ListType) => {
      const favoritesLinks =
        listType === 'favorite'
          ? removeStringFromArray(sessionState.favoritesLinks, threadLink)
          : sessionState.favoritesLinks

      const trashLinks =
        listType === 'trash'
          ? removeStringFromArray(sessionState.trashLinks, threadLink)
          : sessionState.trashLinks

      const playedLinks =
        listType === 'played'
          ? removeStringFromArray(sessionState.playedLinks, threadLink)
          : sessionState.playedLinks

      const playedByLink = { ...sessionState.playedByLink }
      if (listType === 'played') {
        delete playedByLink[threadLink]
      }

      const nextProcessedThreadItems = { ...sessionState.processedThreadItemsByLink }
      const existingItem = nextProcessedThreadItems[threadLink]

      if (existingItem) {
        nextProcessedThreadItems[threadLink] = {
          ...existingItem,
          listType: null,
        }
      }

      persistSessionState({
        ...sessionState,
        favoritesLinks,
        trashLinks,
        playedLinks,
        playedByLink,
        processedThreadItemsByLink: nextProcessedThreadItems,
      })
    },
    [sessionState, persistSessionState],
  )

  const updateTagsMap = useCallback((nextMap: Record<string, string>) => {
    const normalizedMap = { ...nextMap }
    setTagsMapState(normalizedMap)
    saveTagsMap(normalizedMap)
  }, [])

  const updatePrefixesMap = useCallback((nextMap: Record<string, string>) => {
    const normalizedMap = { ...nextMap }
    setPrefixesMapState(normalizedMap)
    savePrefixesMap(normalizedMap)
  }, [])

  const startMetadataSync = useCallback(
    async (requestedPageLimit: number, explicitCandidateLinkList?: string[]) => {
      const pageLimit = Math.max(1, Math.floor(requestedPageLimit))
      const initialState = sessionStateRef.current ?? sessionState
      const candidateLinkList =
        explicitCandidateLinkList ?? collectSyncCandidateLinks(initialState)
      const candidateLinkSet = new Set<string>(candidateLinkList)

      if (candidateLinkSet.size === 0) {
        persistSessionState({
          ...initialState,
          lastMetadataSyncAtUnixMs: Date.now(),
        })
        setMetadataSyncState({
          isRunning: false,
          currentPage: 0,
          pageLimit: 0,
          syncedCount: 0,
          trackedCount: 0,
          error: null,
        })
        return
      }

      setMetadataSyncState({
        isRunning: true,
        currentPage: 0,
        pageLimit,
        syncedCount: 0,
        trackedCount: candidateLinkSet.size,
        error: null,
      })

      const syncedLinkSet = new Set<string>()
      let currentState = initialState
      for (let pageNumber = 1; pageNumber <= pageLimit; pageNumber += 1) {
        const activeState = sessionStateRef.current ?? currentState

        try {
          const pageResult = await loadPage(
            pageNumber,
            activeState.latestGamesSort,
          )
          let nextStateAfterPage = activeState

          if (candidateLinkSet.size > 0 && pageResult.threadItemList.length > 0) {
            const nextProcessedThreadItems = {
              ...activeState.processedThreadItemsByLink,
            }
            let hasUpdated = false

            for (const threadItem of pageResult.threadItemList) {
              const threadLink = buildThreadLink(threadItem.thread_id)
              if (!candidateLinkSet.has(threadLink)) {
                continue
              }

              const listType: ListType | null = activeState.favoritesLinks.includes(
                threadLink,
              )
                ? 'favorite'
                : activeState.trashLinks.includes(threadLink)
                ? 'trash'
                : activeState.playedLinks.includes(threadLink)
                ? 'played'
                : null

              nextProcessedThreadItems[threadLink] = buildProcessedThreadItem(
                threadLink,
                listType,
                threadItem,
                nextProcessedThreadItems[threadLink],
              )
              hasUpdated = true
              syncedLinkSet.add(threadLink)
            }

            if (hasUpdated) {
              nextStateAfterPage = {
                ...activeState,
                processedThreadItemsByLink: nextProcessedThreadItems,
              }
              persistSessionState(nextStateAfterPage)
            }
          }

          currentState = nextStateAfterPage
          setMetadataSyncState((previousState) => ({
            ...previousState,
            currentPage: pageNumber,
            syncedCount: syncedLinkSet.size,
          }))

          if (pageResult.totalPages > 0 && pageNumber >= pageResult.totalPages) {
            break
          }
        } catch (error) {
          setMetadataSyncState((previousState) => ({
            ...previousState,
            isRunning: false,
            currentPage: pageNumber,
            syncedCount: syncedLinkSet.size,
            error: error instanceof Error ? error.message : 'Не удалось синхронизировать метаданные',
          }))
          return
        }
      }

      persistSessionState({
        ...(sessionStateRef.current ?? currentState),
        lastMetadataSyncAtUnixMs: Date.now(),
      })

      setMetadataSyncState((previousState) => ({
        ...previousState,
        isRunning: false,
        syncedCount: syncedLinkSet.size,
        error: null,
      }))
    },
    [loadPage, persistSessionState, sessionState],
  )

  const metadataSyncCandidateLinks = useMemo(
    () => collectSyncCandidateLinks(sessionState),
    [
      sessionState.favoritesLinks,
      sessionState.playedLinks,
      sessionState.processedThreadItemsByLink,
      sessionState.trashLinks,
    ],
  )

  useEffect(() => {
    if (!AUTO_METADATA_SYNC_ENABLED) {
      lastAutoMetadataSyncSignatureRef.current = null
      return
    }

    if (metadataSyncCandidateLinks.length === 0) {
      lastAutoMetadataSyncSignatureRef.current = null
      return
    }

    if (metadataSyncState.isRunning) {
      return
    }

    const nextSignature = metadataSyncCandidateLinks.join('|')
    if (lastAutoMetadataSyncSignatureRef.current === nextSignature) {
      return
    }

    lastAutoMetadataSyncSignatureRef.current = nextSignature
    const autoPageLimit = Math.max(
      5,
      Math.min(20, Math.max(sessionState.currentPageNumber, 1)),
    )
    void startMetadataSync(autoPageLimit, metadataSyncCandidateLinks)
  }, [
    metadataSyncCandidateLinks,
    metadataSyncState.isRunning,
    sessionState.currentPageNumber,
    startMetadataSync,
  ])

  return {
    sessionState,
    currentThreadIdentifier,
    currentThreadItem,
    isLoadingPage,
    errorMessage,
    canUndo: Boolean(undoSnapshot),
    applyActionToCurrentCard,
    undoLastAction,
    updateFilterState,
    setLatestGamesSort,
    resetFilterState,
    defaultFilterState,
    defaultLatestGamesSort,
    updateDefaultFilterState,
    updateDefaultLatestGamesSort,
    replaceDefaultSwipeSettings,
    resetDefaultFilterState,
    saveCurrentFilterStateAsDefault,
    applyDefaultFilterStateToSwipe,
    clearAllData,
    clearDashboardLists,
    tagsMap,
    prefixesMap,
    updateTagsMap,
    updatePrefixesMap,
    metadataSyncState,
    startMetadataSync,
    moveLinkToList,
    removeLinkFromList,
    setErrorMessage,
  }
}

export { useF95Browser }
