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
  SwipeSortMode,
} from './types'
import {
  buildThreadLink,
  fetchLatestGamesPage,
} from './api'
import {
  createDefaultSessionState,
  loadDefaultSwipeSettings,
  loadLatestCatalogSnapshot,
  loadSessionState,
  saveDefaultSwipeSettings,
  saveLatestCatalogState,
  saveSessionState,
  clearAllStoredData,
  DEFAULT_FILTER_STATE,
  loadPrefixesMap,
  loadTagsMap,
  savePrefixesMap,
  saveTagsMap,
} from './storage'
import { normalizeFilterState, threadMatchesFilter } from './filtering'
import { assessThreadInterest, buildInterestProfile } from './recommendations'
import {
  hasProcessedThreadItemUpdate,
  isUpdateTrackedListType,
} from './updateTracking'
import { mergeUniqueStringArrays, removeStringFromArray } from './utils'

const CATALOG_SYNC_BATCH_SIZE = 10
const CATALOG_SYNC_BATCH_DELAY_MS = 10_000
const LATEST_CATALOG_MAX_AGE_MS = 2 * 24 * 60 * 60 * 1_000
const METADATA_SYNC_CONTROL_POLL_MS = 250
const EMPTY_LOOKUP_MAP: Record<string, string> = {}

type ActionType = ListType | 'playedFavorite'

const resolveListTypeFromAction = (actionType: ActionType): ListType => {
  if (actionType === 'playedFavorite') {
    return 'played'
  }
  return actionType
}

const parseThreadIdentifierFromLink = (threadLink: string) => {
  const match = /\/threads\/(\d+)/.exec(threadLink)
  if (!match) {
    return null
  }
  return Number(match[1])
}

const toUnixSeconds = () => Math.floor(Date.now() / 1000)

const normalizeThreadTextValue = (
  value: unknown,
  fallbackValue = '',
) => {
  return typeof value === 'string' ? value : fallbackValue
}

const wait = (durationMs: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, durationMs)
  })

const createMetadataSyncStoppedError = () => {
  const error = new Error('Синхронизация остановлена пользователем.')
  ;(error as Error & { code?: string }).code = 'METADATA_SYNC_STOPPED'
  return error
}

const isMetadataSyncStoppedError = (error: unknown) => {
  return (
    error instanceof Error &&
    (error.message === 'Синхронизация остановлена пользователем.' ||
      (error as Error & { code?: string }).code === 'METADATA_SYNC_STOPPED')
  )
}

const resolveListTypeFromMembership = (
  isInFavorites: boolean,
  isInTrash: boolean,
  isInPlayed: boolean,
): ListType | null => {
  if (isInFavorites) {
    return 'favorite'
  }
  if (isInTrash) {
    return 'trash'
  }
  if (isInPlayed) {
    return 'played'
  }
  return null
}

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
    normalizeThreadTextValue(threadItem?.title, '') ||
    normalizeThreadTextValue(existingItem?.title, '') ||
    `Thread ${threadIdentifier}`
  const fallbackCreator =
    normalizeThreadTextValue(threadItem?.creator, '') ||
    normalizeThreadTextValue(existingItem?.creator, '') ||
    'Unknown'

  const cover =
    normalizeThreadTextValue(threadItem?.cover, '') ||
    normalizeThreadTextValue(existingItem?.cover, '')
  const rating =
    typeof threadItem?.rating === 'number'
      ? threadItem.rating
      : existingItem?.rating ?? 0
  const version =
    normalizeThreadTextValue(threadItem?.version, '') ||
    normalizeThreadTextValue(existingItem?.version, '')
  const prefixes =
    Array.isArray(threadItem?.prefixes)
      ? threadItem.prefixes.filter((prefixId) => typeof prefixId === 'number')
      : Array.isArray(existingItem?.prefixes)
        ? existingItem.prefixes.filter((prefixId) => typeof prefixId === 'number')
        : []

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
    prefixes,
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

const getPlayedFavoriteLinks = (state: SessionState) => {
  return state.playedFavoriteLinks ?? []
}

const getPlayedDislikedLinks = (state: SessionState) => {
  return state.playedDislikedLinks ?? []
}

const getBookmarkedDownloadedLinks = (state: SessionState) => {
  return state.bookmarkedDownloadedLinks ?? []
}

const getTrackedLinkSet = (sessionState: SessionState) => {
  return new Set<string>([
    ...sessionState.favoritesLinks,
    ...sessionState.trashLinks,
    ...getPlayedLinks(sessionState),
  ])
}

const getThreadSortValue = (
  threadItem: F95ThreadItem | undefined,
  latestGamesSort: LatestGamesSort,
) => {
  if (!threadItem) {
    return 0
  }

  if (latestGamesSort === 'views') {
    return typeof threadItem.views === 'number' ? threadItem.views : 0
  }

  if (typeof threadItem.ts === 'number' && Number.isFinite(threadItem.ts)) {
    return threadItem.ts
  }

  const parsedDate = new Date(threadItem.date)
  if (Number.isNaN(parsedDate.getTime())) {
    return 0
  }

  return Math.floor(parsedDate.getTime() / 1000)
}

const sortThreadIdentifiersForSwipe = (
  threadIdentifierList: number[],
  threadItemsByIdentifier: Record<string, F95ThreadItem>,
  latestGamesSort: LatestGamesSort,
) => {
  return [...threadIdentifierList].sort((firstIdentifier, secondIdentifier) => {
    const firstThreadItem = threadItemsByIdentifier[String(firstIdentifier)]
    const secondThreadItem = threadItemsByIdentifier[String(secondIdentifier)]

    const sortComparison =
      getThreadSortValue(secondThreadItem, latestGamesSort) -
      getThreadSortValue(firstThreadItem, latestGamesSort)

    if (sortComparison !== 0) {
      return sortComparison
    }

    return secondIdentifier - firstIdentifier
  })
}

const resolveStoredSwipeSortMode = (
  swipeSortMode: SwipeSortMode,
  latestGamesSort: LatestGamesSort,
): LatestGamesSort => {
  return swipeSortMode === 'interest' ? latestGamesSort : swipeSortMode
}

const buildCatalogSessionState = (
  sessionState: SessionState,
  catalogThreadItemsByIdentifier: Record<string, F95ThreadItem>,
  orderedThreadIdentifierList: number[],
  syncedPageNumber: number,
) => {
  const trackedLinkSet = getTrackedLinkSet(sessionState)
  const nextThreadItemsByIdentifier: Record<string, F95ThreadItem> = {}

  for (const trackedLink of trackedLinkSet) {
    const threadIdentifier = parseThreadIdentifierFromLink(trackedLink)
    if (threadIdentifier === null) {
      continue
    }

    const existingThreadItem =
      sessionState.threadItemsByIdentifier[String(threadIdentifier)]
    if (existingThreadItem) {
      nextThreadItemsByIdentifier[String(threadIdentifier)] = existingThreadItem
    }
  }

  for (const [threadIdentifier, threadItem] of Object.entries(
    catalogThreadItemsByIdentifier,
  )) {
    nextThreadItemsByIdentifier[threadIdentifier] = threadItem
  }

  const remainingThreadIdentifiers = sortThreadIdentifiersForSwipe(
    orderedThreadIdentifierList.filter(
      (threadIdentifier) => !trackedLinkSet.has(buildThreadLink(threadIdentifier)),
    ),
    nextThreadItemsByIdentifier,
    resolveStoredSwipeSortMode(sessionState.swipeSortMode, sessionState.latestGamesSort),
  )

  return {
    ...sessionState,
    currentPageNumber: syncedPageNumber,
    nextPageToFetchNumber: syncedPageNumber + 1,
    threadItemsByIdentifier: nextThreadItemsByIdentifier,
    remainingThreadIdentifiers,
  }
}

const createCatalogSourceSignature = (defaultSwipeSettings: DefaultSwipeSettings) => {
  return JSON.stringify({
    latestGamesSort: defaultSwipeSettings.latestGamesSort,
    filterState: normalizeFilterState(defaultSwipeSettings.filterState),
  })
}

const isLatestCatalogFresh = (
  updatedAtUnixMs: number | null,
  sourceSignature: string | null,
  defaultSwipeSettings: DefaultSwipeSettings,
) => {
  if (updatedAtUnixMs === null || !sourceSignature) {
    return false
  }

  if (Date.now() - updatedAtUnixMs > LATEST_CATALOG_MAX_AGE_MS) {
    return false
  }

  return sourceSignature === createCatalogSourceSignature(defaultSwipeSettings)
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
  const favoriteLinkSet = new Set(sessionState.favoritesLinks)
  const playedLinkSet = new Set(getPlayedLinks(sessionState))
  const nextPlayedDislikedLinks = getPlayedDislikedLinks(sessionState).filter((threadLink) =>
    playedLinkSet.has(threadLink),
  )
  const nextPlayedDislikedLinkSet = new Set(nextPlayedDislikedLinks)
  const hasPlayedDislikedChanged =
    nextPlayedDislikedLinks.length !== getPlayedDislikedLinks(sessionState).length
  const nextBookmarkedDownloadedLinks = getBookmarkedDownloadedLinks(sessionState).filter(
    (threadLink) => favoriteLinkSet.has(threadLink),
  )
  const hasBookmarkedDownloadedChanged =
    nextBookmarkedDownloadedLinks.length !==
    getBookmarkedDownloadedLinks(sessionState).length
  const nextPlayedFavoriteLinks = getPlayedFavoriteLinks(sessionState).filter((threadLink) =>
    playedLinkSet.has(threadLink) && !nextPlayedDislikedLinkSet.has(threadLink),
  )
  const hasPlayedFavoritesChanged =
    nextPlayedFavoriteLinks.length !== getPlayedFavoriteLinks(sessionState).length

  const nextRemainingThreadIdentifiers = sessionState.remainingThreadIdentifiers.filter(
    (threadIdentifier) => !trackedLinkSet.has(buildThreadLink(threadIdentifier)),
  )

  if (
    nextRemainingThreadIdentifiers.length ===
      sessionState.remainingThreadIdentifiers.length &&
    !hasPlayedDislikedChanged &&
    !hasBookmarkedDownloadedChanged &&
    !hasPlayedFavoritesChanged
  ) {
    return sessionState
  }

  return {
    ...sessionState,
    playedDislikedLinks: nextPlayedDislikedLinks,
    bookmarkedDownloadedLinks: nextBookmarkedDownloadedLinks,
    playedFavoriteLinks: nextPlayedFavoriteLinks,
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

const pickCurrentThreadIdentifier = (
  threadIdentifierList: number[],
  sessionState: SessionState,
) => {
  for (const threadIdentifier of threadIdentifierList) {
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

type PersistSessionStateOptions = {
  skipSanitize?: boolean
}

const useF95Browser = () => {
  const sessionStateRef = useRef<SessionState | null>(null)
  const defaultSwipeSettingsRef = useRef<DefaultSwipeSettings>(
    createSavedDefaultSwipeSettings(loadDefaultSwipeSettings()),
  )
  const initialLatestCatalogSnapshotRef = useRef(loadLatestCatalogSnapshot())
  const [defaultSwipeSettings, setDefaultSwipeSettings] =
    useState<DefaultSwipeSettings>(() => defaultSwipeSettingsRef.current)
  const defaultFilterState = defaultSwipeSettings.filterState
  const defaultLatestGamesSort = defaultSwipeSettings.latestGamesSort
  const [sessionState, setSessionState] = useState<SessionState>(() => {
    const loadedSessionState = loadSessionState()
    const baseState = sanitizeSwipeQueue(
      loadedSessionState ??
        createDefaultSessionState(defaultSwipeSettingsRef.current),
    )
    const latestCatalog = initialLatestCatalogSnapshotRef.current.catalog
    const initialState = latestCatalog
      ? sanitizeSwipeQueue(
          buildCatalogSessionState(
            baseState,
            latestCatalog.threadItemsByIdentifier,
            latestCatalog.orderedThreadIdentifiers,
            latestCatalog.pageCount,
          ),
        )
      : baseState

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
    isPaused: false,
    isStopping: false,
    currentPage: initialLatestCatalogSnapshotRef.current.catalog?.pageCount ?? 0,
    pageLimit: initialLatestCatalogSnapshotRef.current.catalog?.pageCount ?? 0,
    syncedCount: Object.keys(
      initialLatestCatalogSnapshotRef.current.catalog?.threadItemsByIdentifier ?? {},
    ).length,
    updatedTrackedCount: 0,
    lastOutcome: initialLatestCatalogSnapshotRef.current.catalog ? 'completed' : null,
    error: null,
  })
  const hasStartedInitialMetadataSyncRef = useRef(false)
  const isMetadataSyncRunningRef = useRef(false)
  const isMetadataSyncPausedRef = useRef(false)
  const isMetadataSyncStopRequestedRef = useRef(false)
  const metadataSyncAbortControllerRef = useRef<AbortController | null>(null)
  const interestProfile = useMemo(
    () => buildInterestProfile(sessionState),
    [
      sessionState.favoritesLinks,
      sessionState.playedDislikedLinks,
      sessionState.playedFavoriteLinks,
      sessionState.playedLinks,
      sessionState.processedThreadItemsByLink,
      sessionState.trashLinks,
    ],
  )

  const throwIfMetadataSyncStopped = useCallback(() => {
    if (isMetadataSyncStopRequestedRef.current) {
      throw createMetadataSyncStoppedError()
    }
  }, [])

  const waitForMetadataSyncReady = useCallback(async () => {
    throwIfMetadataSyncStopped()

    while (isMetadataSyncPausedRef.current) {
      throwIfMetadataSyncStopped()
      await wait(METADATA_SYNC_CONTROL_POLL_MS)
    }

    throwIfMetadataSyncStopped()
  }, [throwIfMetadataSyncStopped])

  const waitForMetadataSyncDelay = useCallback(
    async (durationMs: number) => {
      let remainingMs = durationMs
      while (remainingMs > 0) {
        await waitForMetadataSyncReady()
        const stepMs = Math.min(METADATA_SYNC_CONTROL_POLL_MS, remainingMs)
        await wait(stepMs)
        remainingMs -= stepMs
      }
    },
    [waitForMetadataSyncReady],
  )

  const interestSortedSnapshotThreadIdentifiers = useMemo(() => {
    if (sessionState.swipeSortMode !== 'interest') {
      return sessionState.remainingThreadIdentifiers
    }

    const stableSortMode = resolveStoredSwipeSortMode(
      sessionState.swipeSortMode,
      sessionState.latestGamesSort,
    )

    return [...sessionState.remainingThreadIdentifiers].sort(
      (firstIdentifier, secondIdentifier) => {
        const firstThreadItem =
          sessionState.threadItemsByIdentifier[String(firstIdentifier)]
        const secondThreadItem =
          sessionState.threadItemsByIdentifier[String(secondIdentifier)]

        const firstScore =
          assessThreadInterest(
            firstThreadItem,
            interestProfile,
            EMPTY_LOOKUP_MAP,
            EMPTY_LOOKUP_MAP,
          )?.score ?? 50
        const secondScore =
          assessThreadInterest(
            secondThreadItem,
            interestProfile,
            EMPTY_LOOKUP_MAP,
            EMPTY_LOOKUP_MAP,
          )?.score ?? 50

        if (secondScore !== firstScore) {
          return secondScore - firstScore
        }

        const tieBreak =
          getThreadSortValue(secondThreadItem, stableSortMode) -
          getThreadSortValue(firstThreadItem, stableSortMode)

        if (tieBreak !== 0) {
          return tieBreak
        }

        return secondIdentifier - firstIdentifier
      },
    )
  }, [
    interestProfile,
    sessionState.latestGamesSort,
    sessionState.remainingThreadIdentifiers,
    sessionState.swipeSortMode,
    sessionState.threadItemsByIdentifier,
  ])

  const orderedSwipeThreadIdentifiers = useMemo(() => {
    if (sessionState.swipeSortMode !== 'interest') {
      return sessionState.remainingThreadIdentifiers
    }

    const remainingIdentifierSet = new Set(sessionState.remainingThreadIdentifiers)
    return interestSortedSnapshotThreadIdentifiers.filter((threadIdentifier) =>
      remainingIdentifierSet.has(threadIdentifier),
    )
  }, [
    interestSortedSnapshotThreadIdentifiers,
    sessionState.remainingThreadIdentifiers,
    sessionState.swipeSortMode,
  ])

  const currentThreadIdentifier = useMemo(
    () => pickCurrentThreadIdentifier(orderedSwipeThreadIdentifiers, sessionState),
    [orderedSwipeThreadIdentifiers, sessionState],
  )
  const currentThreadItem = useMemo(() => {
    if (currentThreadIdentifier === null) {
      return null
    }
    return sessionState.threadItemsByIdentifier[String(currentThreadIdentifier)] ?? null
  }, [currentThreadIdentifier, sessionState.threadItemsByIdentifier])

  const persistSessionState = useCallback(
    (
      nextSessionState: SessionState,
      options?: PersistSessionStateOptions,
    ) => {
      const persistedSessionState = options?.skipSanitize
        ? nextSessionState
        : sanitizeSwipeQueue(nextSessionState)
      sessionStateRef.current = persistedSessionState
      setSessionState(persistedSessionState)
      saveSessionState(persistedSessionState)
    },
    [],
  )

  const persistDefaultSwipeSettings = useCallback((nextDefaultSwipeSettings: DefaultSwipeSettings) => {
    const sanitizedDefaultSwipeSettings =
      createSavedDefaultSwipeSettings(nextDefaultSwipeSettings)
    defaultSwipeSettingsRef.current = sanitizedDefaultSwipeSettings
    setDefaultSwipeSettings(sanitizedDefaultSwipeSettings)
    saveDefaultSwipeSettings(sanitizedDefaultSwipeSettings)
  }, [])

  const restartSwipeFeed = useCallback(
    (nextLatestGamesSort: LatestGamesSort, nextFilterState: FilterState) => {
      const liveSessionState = sessionStateRef.current
      if (!liveSessionState) {
        return
      }

      setUndoSnapshot(null)
      setErrorMessage(null)
      const normalizedFilterState = normalizeFilterState(nextFilterState)
      const nextLiveSessionState = {
        ...liveSessionState,
        latestGamesSort: nextLatestGamesSort,
        filterState: normalizedFilterState,
      }

      persistSessionState(
        {
          ...nextLiveSessionState,
          remainingThreadIdentifiers: sortThreadIdentifiersForSwipe(
            liveSessionState.remainingThreadIdentifiers,
            liveSessionState.threadItemsByIdentifier,
            resolveStoredSwipeSortMode(
              liveSessionState.swipeSortMode,
              nextLatestGamesSort,
            ),
          ),
        },
        { skipSanitize: true },
      )
    },
    [persistSessionState],
  )

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
      const resolvedListType = resolveListTypeFromAction(actionType)

      const remainingThreadIdentifiersAfterAction = [...sessionState.remainingThreadIdentifiers]
      remainingThreadIdentifiersAfterAction.splice(currentThreadIdentifierIndex, 1)

      const favoritesLinksNext =
        resolvedListType === 'favorite'
          ? mergeUniqueStringArrays(sessionState.favoritesLinks, [threadLink])
          : removeStringFromArray(sessionState.favoritesLinks, threadLink)

      const trashLinksNext =
        resolvedListType === 'trash'
          ? mergeUniqueStringArrays(sessionState.trashLinks, [threadLink])
          : removeStringFromArray(sessionState.trashLinks, threadLink)

      const playedLinksNext =
        resolvedListType === 'played'
          ? mergeUniqueStringArrays(sessionState.playedLinks, [threadLink])
          : removeStringFromArray(sessionState.playedLinks, threadLink)
      const playedFavoriteLinksNext =
        actionType === 'playedFavorite'
          ? mergeUniqueStringArrays(sessionState.playedFavoriteLinks, [threadLink])
          : resolvedListType === 'played'
          ? sessionState.playedFavoriteLinks
          : removeStringFromArray(sessionState.playedFavoriteLinks, threadLink)
      const playedDislikedLinksNext =
        actionType === 'playedFavorite'
          ? removeStringFromArray(sessionState.playedDislikedLinks, threadLink)
          : resolvedListType === 'played'
          ? sessionState.playedDislikedLinks
          : removeStringFromArray(sessionState.playedDislikedLinks, threadLink)

      const playedByLinkNext = { ...sessionState.playedByLink }
      if (resolvedListType === 'played') {
        playedByLinkNext[threadLink] = true
      } else {
        delete playedByLinkNext[threadLink]
      }

      const processedThreadItemsByLinkNext: Record<string, ProcessedThreadItem> = {
        ...sessionState.processedThreadItemsByLink,
      }

      const processedItem = buildProcessedThreadItem(
        threadLink,
        resolvedListType,
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
        playedFavoriteLinks: playedFavoriteLinksNext,
        playedDislikedLinks: playedDislikedLinksNext,
        playedByLink: playedByLinkNext,
        processedThreadItemsByLink: processedThreadItemsByLinkNext,
        viewedCount: sessionState.viewedCount + 1,
      }

      persistSessionState(nextSessionState, { skipSanitize: true })
    },
    [currentThreadIdentifier, persistSessionState, sessionState],
  )

  const undoLastAction = useCallback(() => {
    if (!undoSnapshot) {
      return
    }

    persistSessionState(undoSnapshot.sessionStateBefore, { skipSanitize: true })
    setUndoSnapshot(null)
  }, [persistSessionState, undoSnapshot])

  const updateFilterState = useCallback(
    (partialFilterState: Partial<FilterState>) => {
      const liveSessionState = sessionStateRef.current ?? sessionState
      const nextFilterState = normalizeFilterState({
        ...liveSessionState.filterState,
        ...partialFilterState,
      })

      if (
        JSON.stringify(nextFilterState) ===
        JSON.stringify(liveSessionState.filterState)
      ) {
        return
      }

      restartSwipeFeed(liveSessionState.latestGamesSort, nextFilterState)
    },
    [restartSwipeFeed, sessionState],
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

      restartSwipeFeed(latestGamesSort, liveSessionState.filterState)
    },
    [restartSwipeFeed],
  )

  const setSwipeSortMode = useCallback(
    (swipeSortMode: SwipeSortMode) => {
      const liveSessionState = sessionStateRef.current
      if (!liveSessionState || liveSessionState.swipeSortMode === swipeSortMode) {
        return
      }

      persistSessionState(
        {
          ...liveSessionState,
          swipeSortMode,
          remainingThreadIdentifiers:
            swipeSortMode === 'interest'
              ? liveSessionState.remainingThreadIdentifiers
              : sortThreadIdentifiersForSwipe(
                  liveSessionState.remainingThreadIdentifiers,
                  liveSessionState.threadItemsByIdentifier,
                  swipeSortMode,
                ),
        },
        { skipSanitize: true },
      )
    },
    [persistSessionState],
  )

  const resetFilterState = useCallback(() => {
    restartSwipeFeed(
      defaultSwipeSettingsRef.current.latestGamesSort,
      defaultSwipeSettingsRef.current.filterState,
    )
  }, [restartSwipeFeed])

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
    restartSwipeFeed(
      defaultSwipeSettingsRef.current.latestGamesSort,
      defaultSwipeSettingsRef.current.filterState,
    )
  }, [restartSwipeFeed])

  const clearAllData = useCallback(() => {
    clearAllStoredData()
    setUndoSnapshot(null)
    setErrorMessage(null)
    setIsLoadingPage(false)
    setTagsMapState({})
    setPrefixesMapState({})
    setMetadataSyncState({
      isRunning: false,
      isPaused: false,
      isStopping: false,
      currentPage: 0,
      pageLimit: 0,
      syncedCount: 0,
      updatedTrackedCount: 0,
      lastOutcome: null,
      error: null,
    })
    initialLatestCatalogSnapshotRef.current = {
      catalog: null,
      updatedAtUnixMs: null,
      path: null,
    }
    const nextBuiltInDefaultSwipeSettings = createSavedDefaultSwipeSettings(
      loadDefaultSwipeSettings(),
    )
    const nextState = createDefaultSessionState(nextBuiltInDefaultSwipeSettings)
    defaultSwipeSettingsRef.current = nextBuiltInDefaultSwipeSettings
    setDefaultSwipeSettings(nextBuiltInDefaultSwipeSettings)
    persistSessionState(nextState, { skipSanitize: true })
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
    persistSessionState(
      {
        ...sessionState,
        favoritesLinks: [],
        bookmarkedDownloadedLinks: [],
        trashLinks: [],
        playedLinks: [],
        playedFavoriteLinks: [],
        playedDislikedLinks: [],
        playedByLink: {},
        processedThreadItemsByLink: nextProcessedThreadItems,
      },
      { skipSanitize: true },
    )
  }, [persistSessionState, sessionState])

  const moveLinkToList = useCallback(
    (threadLink: string, targetList: ListType) => {
      const favoritesLinks =
        targetList === 'favorite'
          ? mergeUniqueStringArrays(sessionState.favoritesLinks, [threadLink])
          : removeStringFromArray(sessionState.favoritesLinks, threadLink)
      const bookmarkedDownloadedLinks =
        targetList === 'favorite'
          ? sessionState.bookmarkedDownloadedLinks
          : removeStringFromArray(sessionState.bookmarkedDownloadedLinks, threadLink)

      const trashLinks =
        targetList === 'trash'
          ? mergeUniqueStringArrays(sessionState.trashLinks, [threadLink])
          : removeStringFromArray(sessionState.trashLinks, threadLink)

      const playedLinks =
        targetList === 'played'
          ? mergeUniqueStringArrays(sessionState.playedLinks, [threadLink])
          : removeStringFromArray(sessionState.playedLinks, threadLink)
      const playedFavoriteLinks =
        targetList === 'played'
          ? sessionState.playedFavoriteLinks
          : removeStringFromArray(sessionState.playedFavoriteLinks, threadLink)
      const playedDislikedLinks =
        targetList === 'played'
          ? sessionState.playedDislikedLinks
          : removeStringFromArray(sessionState.playedDislikedLinks, threadLink)

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

      persistSessionState(
        {
          ...sessionState,
          favoritesLinks,
          bookmarkedDownloadedLinks,
          trashLinks,
          playedLinks,
          playedFavoriteLinks,
          playedDislikedLinks,
          playedByLink,
          processedThreadItemsByLink: nextProcessedThreadItems,
        },
        { skipSanitize: true },
      )
    },
    [sessionState, persistSessionState],
  )

  const togglePlayedFavoriteLink = useCallback(
    (threadLink: string) => {
      if (!sessionState.playedLinks.includes(threadLink)) {
        return
      }

      const isInPlayedFavorites = sessionState.playedFavoriteLinks.includes(threadLink)
      const playedFavoriteLinks = isInPlayedFavorites
        ? removeStringFromArray(sessionState.playedFavoriteLinks, threadLink)
        : mergeUniqueStringArrays(sessionState.playedFavoriteLinks, [threadLink])
      const playedDislikedLinks = isInPlayedFavorites
        ? sessionState.playedDislikedLinks
        : removeStringFromArray(sessionState.playedDislikedLinks, threadLink)

      persistSessionState(
        {
          ...sessionState,
          playedFavoriteLinks,
          playedDislikedLinks,
        },
        { skipSanitize: true },
      )
    },
    [sessionState, persistSessionState],
  )

  const togglePlayedDislikedLink = useCallback(
    (threadLink: string) => {
      if (!sessionState.playedLinks.includes(threadLink)) {
        return
      }

      const isInPlayedDisliked = sessionState.playedDislikedLinks.includes(threadLink)
      const playedDislikedLinks = isInPlayedDisliked
        ? removeStringFromArray(sessionState.playedDislikedLinks, threadLink)
        : mergeUniqueStringArrays(sessionState.playedDislikedLinks, [threadLink])
      const playedFavoriteLinks = isInPlayedDisliked
        ? sessionState.playedFavoriteLinks
        : removeStringFromArray(sessionState.playedFavoriteLinks, threadLink)

      persistSessionState(
        {
          ...sessionState,
          playedFavoriteLinks,
          playedDislikedLinks,
        },
        { skipSanitize: true },
      )
    },
    [sessionState, persistSessionState],
  )

  const toggleBookmarkedDownloadedLink = useCallback(
    (threadLink: string) => {
      if (!sessionState.favoritesLinks.includes(threadLink)) {
        return
      }

      const isBookmarkedDownloaded =
        sessionState.bookmarkedDownloadedLinks.includes(threadLink)
      const bookmarkedDownloadedLinks = isBookmarkedDownloaded
        ? removeStringFromArray(sessionState.bookmarkedDownloadedLinks, threadLink)
        : mergeUniqueStringArrays(sessionState.bookmarkedDownloadedLinks, [threadLink])

      persistSessionState(
        {
          ...sessionState,
          bookmarkedDownloadedLinks,
        },
        { skipSanitize: true },
      )
    },
    [sessionState, persistSessionState],
  )

  const removeLinkFromList = useCallback(
    (threadLink: string, listType: ListType) => {
      const favoritesLinks =
        listType === 'favorite'
          ? removeStringFromArray(sessionState.favoritesLinks, threadLink)
          : sessionState.favoritesLinks
      const bookmarkedDownloadedLinks =
        listType === 'favorite'
          ? removeStringFromArray(sessionState.bookmarkedDownloadedLinks, threadLink)
          : sessionState.bookmarkedDownloadedLinks

      const trashLinks =
        listType === 'trash'
          ? removeStringFromArray(sessionState.trashLinks, threadLink)
          : sessionState.trashLinks

      const playedLinks =
        listType === 'played'
          ? removeStringFromArray(sessionState.playedLinks, threadLink)
          : sessionState.playedLinks
      const playedFavoriteLinks =
        listType === 'played'
          ? removeStringFromArray(sessionState.playedFavoriteLinks, threadLink)
          : sessionState.playedFavoriteLinks
      const playedDislikedLinks =
        listType === 'played'
          ? removeStringFromArray(sessionState.playedDislikedLinks, threadLink)
          : sessionState.playedDislikedLinks

      const playedByLink = { ...sessionState.playedByLink }
      if (listType === 'played') {
        delete playedByLink[threadLink]
      }

      const nextProcessedThreadItems = { ...sessionState.processedThreadItemsByLink }
      const existingItem = nextProcessedThreadItems[threadLink]
      const nextListType = resolveListTypeFromMembership(
        favoritesLinks.includes(threadLink),
        trashLinks.includes(threadLink),
        playedLinks.includes(threadLink),
      )
      const threadIdentifier = parseThreadIdentifierFromLink(threadLink)
      const threadItem =
        threadIdentifier !== null
          ? sessionState.threadItemsByIdentifier[String(threadIdentifier)]
          : null

      if (existingItem || threadItem) {
        nextProcessedThreadItems[threadLink] = buildProcessedThreadItem(
          threadLink,
          nextListType,
          threadItem,
          existingItem,
        )
      }

      persistSessionState(
        {
          ...sessionState,
          favoritesLinks,
          bookmarkedDownloadedLinks,
          trashLinks,
          playedLinks,
          playedFavoriteLinks,
          playedDislikedLinks,
          playedByLink,
          processedThreadItemsByLink: nextProcessedThreadItems,
        },
        { skipSanitize: true },
      )
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
    async () => {
      if (isMetadataSyncRunningRef.current) {
        return
      }

      isMetadataSyncRunningRef.current = true
      isMetadataSyncPausedRef.current = false
      isMetadataSyncStopRequestedRef.current = false
      const initialState = sessionStateRef.current ?? sessionState
      const syncSettings = createSavedDefaultSwipeSettings(
        defaultSwipeSettingsRef.current,
      )
      const shouldShowInitialLoader =
        Object.keys(initialState.threadItemsByIdentifier).length === 0
      const catalogThreadItemsByIdentifier: Record<string, F95ThreadItem> = {}
      const orderedThreadIdentifierList: number[] = []
      const seenThreadIdentifierSet = new Set<number>()
      const updatedTrackedLinkSet = new Set<string>()
      let currentState = initialState
      let totalPages = 0

      setErrorMessage(null)
      setIsLoadingPage(shouldShowInitialLoader)
      setMetadataSyncState({
        isRunning: true,
        isPaused: false,
        isStopping: false,
        currentPage: 0,
        pageLimit: 0,
        syncedCount: 0,
        updatedTrackedCount: 0,
        lastOutcome: null,
        error: null,
      })

      try {
        for (let pageNumber = 1; ; pageNumber += 1) {
          await waitForMetadataSyncReady()
          const abortController = new AbortController()
          metadataSyncAbortControllerRef.current = abortController
          const pageResult = await fetchLatestGamesPage(
            pageNumber,
            abortController.signal,
            syncSettings.latestGamesSort,
            syncSettings.filterState,
          )
          metadataSyncAbortControllerRef.current = null

          if (pageResult.totalPages > 0) {
            totalPages = pageResult.totalPages
          }

          for (const threadItem of pageResult.threadItemList) {
            const threadIdentifier = threadItem.thread_id
            catalogThreadItemsByIdentifier[String(threadIdentifier)] = threadItem

            if (seenThreadIdentifierSet.has(threadIdentifier)) {
              continue
            }

            seenThreadIdentifierSet.add(threadIdentifier)
            orderedThreadIdentifierList.push(threadIdentifier)
          }

          const activeState = sessionStateRef.current ?? currentState
          let nextProcessedThreadItems = activeState.processedThreadItemsByLink
          let hasProcessedThreadItemsUpdate = false

          for (const threadItem of pageResult.threadItemList) {
            const threadLink = buildThreadLink(threadItem.thread_id)
            const listType = resolveListTypeFromMembership(
              activeState.favoritesLinks.includes(threadLink),
              activeState.trashLinks.includes(threadLink),
              activeState.playedLinks.includes(threadLink),
            )

            if (!listType) {
              continue
            }

            if (!hasProcessedThreadItemsUpdate) {
              nextProcessedThreadItems = {
                ...activeState.processedThreadItemsByLink,
              }
              hasProcessedThreadItemsUpdate = true
            }

            const nextProcessedThreadItem = buildProcessedThreadItem(
              threadLink,
              listType,
              threadItem,
              nextProcessedThreadItems[threadLink],
            )

            nextProcessedThreadItems[threadLink] = nextProcessedThreadItem
            if (hasProcessedThreadItemUpdate(nextProcessedThreadItem)) {
              updatedTrackedLinkSet.add(threadLink)
            }
          }

          const nextBaseState = hasProcessedThreadItemsUpdate
            ? {
                ...activeState,
                processedThreadItemsByLink: nextProcessedThreadItems,
              }
            : activeState

          const nextStateAfterPage = buildCatalogSessionState(
            nextBaseState,
            catalogThreadItemsByIdentifier,
            orderedThreadIdentifierList,
            pageNumber,
          )

          persistSessionState(nextStateAfterPage, { skipSanitize: true })
          currentState = nextStateAfterPage
          setMetadataSyncState({
            isRunning: true,
            isPaused: isMetadataSyncPausedRef.current,
            isStopping: isMetadataSyncStopRequestedRef.current,
            currentPage: pageNumber,
            pageLimit: totalPages,
            syncedCount: orderedThreadIdentifierList.length,
            updatedTrackedCount: updatedTrackedLinkSet.size,
            lastOutcome: null,
            error: null,
          })

          const isLastPage =
            pageResult.threadItemList.length === 0 ||
            (pageResult.totalPages > 0 && pageNumber >= pageResult.totalPages)

          if (isLastPage) {
            break
          }

          if (pageNumber % CATALOG_SYNC_BATCH_SIZE === 0) {
            await waitForMetadataSyncDelay(CATALOG_SYNC_BATCH_DELAY_MS)
          }
        }

        persistSessionState(
          {
            ...(sessionStateRef.current ?? currentState),
            lastMetadataSyncAtUnixMs: Date.now(),
          },
          { skipSanitize: true },
        )

        const nextCatalogState = {
          threadItemsByIdentifier: catalogThreadItemsByIdentifier,
          orderedThreadIdentifiers: orderedThreadIdentifierList,
          pageCount:
            totalPages > 0
              ? totalPages
              : (sessionStateRef.current ?? currentState).currentPageNumber,
          sourceLatestGamesSort: syncSettings.latestGamesSort,
          sourceFilterState: syncSettings.filterState,
        }
        saveLatestCatalogState(nextCatalogState)
        initialLatestCatalogSnapshotRef.current = loadLatestCatalogSnapshot()

        setMetadataSyncState({
          isRunning: false,
          isPaused: false,
          isStopping: false,
          currentPage:
            (sessionStateRef.current ?? currentState).currentPageNumber,
          pageLimit: totalPages,
          syncedCount: orderedThreadIdentifierList.length,
          updatedTrackedCount: updatedTrackedLinkSet.size,
          lastOutcome: 'completed',
          error: null,
        })
      } catch (error) {
        if (metadataSyncAbortControllerRef.current?.signal.aborted) {
          metadataSyncAbortControllerRef.current = null
        }

        if (
          isMetadataSyncStopRequestedRef.current ||
          isMetadataSyncStoppedError(error)
        ) {
          setMetadataSyncState((previousState) => ({
            ...previousState,
            isRunning: false,
            isPaused: false,
            isStopping: false,
            lastOutcome: 'stopped',
            error: null,
          }))
          return
        }

        setMetadataSyncState((previousState) => ({
          ...previousState,
          isRunning: false,
          isPaused: false,
          isStopping: false,
          lastOutcome: null,
          error:
            error instanceof Error
              ? error.message
              : 'Не удалось синхронизировать каталог latest_data.php',
        }))
      } finally {
        isMetadataSyncRunningRef.current = false
        isMetadataSyncPausedRef.current = false
        isMetadataSyncStopRequestedRef.current = false
        metadataSyncAbortControllerRef.current = null
        setIsLoadingPage(false)
      }
    },
    [
      persistSessionState,
      sessionState,
      waitForMetadataSyncDelay,
      waitForMetadataSyncReady,
    ],
  )

  const pauseMetadataSync = useCallback(() => {
    if (
      !isMetadataSyncRunningRef.current ||
      isMetadataSyncPausedRef.current ||
      isMetadataSyncStopRequestedRef.current
    ) {
      return
    }

    isMetadataSyncPausedRef.current = true
    setMetadataSyncState((previousState) => ({
      ...previousState,
      isRunning: true,
      isPaused: true,
      isStopping: false,
      error: null,
    }))
  }, [])

  const resumeMetadataSync = useCallback(() => {
    if (
      !isMetadataSyncRunningRef.current ||
      !isMetadataSyncPausedRef.current ||
      isMetadataSyncStopRequestedRef.current
    ) {
      return
    }

    isMetadataSyncPausedRef.current = false
    setMetadataSyncState((previousState) => ({
      ...previousState,
      isRunning: true,
      isPaused: false,
      isStopping: false,
      error: null,
    }))
  }, [])

  const stopMetadataSync = useCallback(() => {
    if (!isMetadataSyncRunningRef.current || isMetadataSyncStopRequestedRef.current) {
      return
    }

    isMetadataSyncStopRequestedRef.current = true
    isMetadataSyncPausedRef.current = false
    metadataSyncAbortControllerRef.current?.abort()
    setMetadataSyncState((previousState) => ({
      ...previousState,
      isRunning: true,
      isPaused: false,
      isStopping: true,
      error: null,
    }))
  }, [])

  useEffect(() => {
    if (hasStartedInitialMetadataSyncRef.current) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      if (hasStartedInitialMetadataSyncRef.current) {
        return
      }

      hasStartedInitialMetadataSyncRef.current = true
      if (
        isLatestCatalogFresh(
          initialLatestCatalogSnapshotRef.current.updatedAtUnixMs,
          initialLatestCatalogSnapshotRef.current.catalog
            ? createCatalogSourceSignature({
                latestGamesSort:
                  initialLatestCatalogSnapshotRef.current.catalog.sourceLatestGamesSort,
                filterState:
                  initialLatestCatalogSnapshotRef.current.catalog.sourceFilterState,
              })
            : null,
          createSavedDefaultSwipeSettings(defaultSwipeSettingsRef.current),
        )
      ) {
        return
      }

      void startMetadataSync()
    }, 0)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [startMetadataSync])

  return {
    sessionState,
    orderedSwipeThreadIdentifiers,
    currentThreadIdentifier,
    currentThreadItem,
    isLoadingPage,
    errorMessage,
    canUndo: Boolean(undoSnapshot),
    applyActionToCurrentCard,
    undoLastAction,
    updateFilterState,
    setLatestGamesSort,
    setSwipeSortMode,
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
    pauseMetadataSync,
    resumeMetadataSync,
    stopMetadataSync,
    moveLinkToList,
    togglePlayedFavoriteLink,
    togglePlayedDislikedLink,
    toggleBookmarkedDownloadedLink,
    removeLinkFromList,
    setErrorMessage,
  }
}

export { useF95Browser }
