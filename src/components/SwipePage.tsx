import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  buildLatestGamesDataRequestUrl,
  buildThreadLink,
} from "../f95/api";
import {
  loadCachedThreadDownloads,
  loadOrFetchThreadDownloads,
} from "../f95/downloads";
import {
  MAX_TAG_FILTERS_PER_GROUP,
  normalizeText,
  threadMatchesFilter,
} from "../f95/filtering";
import {
  assessThreadInterest,
  buildCatalogFeatureStats,
  buildInterestProfile,
} from "../f95/recommendations";
import type {
  F95ThreadItem,
  FilterState,
  LatestGamesSort,
  MetadataSyncState,
  SessionState,
  SwipeSortMode,
} from "../f95/types";
import { TagChips } from "./TagChips";
import { SwipeFilterModal } from "./SwipeFilterModal";
import {
  clamp,
  createIdleSwipeGestureState,
  createIdleSwipePointerState,
  DOWNLOAD_PRELOAD_LIMIT,
  formatCompactNumber,
  formatThreadDateLabel,
  getSwipeActionCopy,
  isInteractiveSwipeTarget,
  isTextInputFocused,
  resolveSwipeActionFromOffset,
  SWIPE_MAX_TILT_DEG,
  SWIPE_ORDER_OPTIONS,
  SWIPE_SORT_OPTIONS,
  type SwipeGestureState,
  type SwipePointerState,
  type SwipeQueueSnapshot,
} from "../app/swipe";
import { parseThreadIdentifierFromLink } from "../app/threadSelectors";
import { openLinkInNewTab } from "../app/linking";

type SwipePageProps = {
  sessionState: SessionState;
  orderedSwipeThreadIdentifiers: number[];
  currentThreadIdentifier: number | null;
  currentThreadItem: F95ThreadItem | null;
  currentThreadLink: string | null;
  isLoadingPage: boolean;
  canUndo: boolean;
  metadataSyncState: MetadataSyncState;
  tagsMap: Record<string, string>;
  prefixesMap: Record<string, string>;
  defaultFilterState: FilterState;
  defaultLatestGamesSort: LatestGamesSort;
  updateFilterState: (partialFilterState: Partial<FilterState>) => void;
  setLatestGamesSort: (latestGamesSort: LatestGamesSort) => void;
  setSwipeSortMode: (swipeSortMode: SwipeSortMode) => void;
  resetFilterState: () => void;
  undoLastAction: () => void;
  setErrorMessage: (
    value:
      | string
      | null
      | ((previousValue: string | null) => string | null),
  ) => void;
  onFavorite: () => void;
  onTrash: () => void;
  onPlayed: () => void;
  onPlayedFavorite: () => void;
  onOpenViewer: (imageUrlList: string[], startIndex: number) => void;
  onOpenCurrentThread: () => void;
  onOpenCurrentThreadInBackground: () => void;
  onPauseMetadataSync: () => void;
  onResumeMetadataSync: () => void;
  onStopMetadataSync: () => void;
  isViewerOpen: boolean;
  isDownloadModalOpen: boolean;
  isCookiePromptOpen: boolean;
};

const SwipePage = ({
  sessionState,
  orderedSwipeThreadIdentifiers,
  currentThreadIdentifier,
  currentThreadItem,
  currentThreadLink,
  isLoadingPage,
  canUndo,
  metadataSyncState,
  tagsMap,
  prefixesMap,
  defaultFilterState,
  defaultLatestGamesSort,
  updateFilterState,
  setLatestGamesSort,
  setSwipeSortMode,
  resetFilterState,
  undoLastAction,
  setErrorMessage,
  onFavorite,
  onTrash,
  onPlayed,
  onPlayedFavorite,
  onOpenViewer,
  onOpenCurrentThread,
  onOpenCurrentThreadInBackground,
  onPauseMetadataSync,
  onResumeMetadataSync,
  onStopMetadataSync,
  isViewerOpen,
  isDownloadModalOpen,
  isCookiePromptOpen,
}: SwipePageProps) => {
  const [swipeGestureState, setSwipeGestureState] = useState<SwipeGestureState>(() =>
    createIdleSwipeGestureState(),
  );
  const [isSwipeFilterModalOpen, setIsSwipeFilterModalOpen] = useState(false);
  const [swipeTagSearchText, setSwipeTagSearchText] = useState("");
  const [swipePrefixSearchText, setSwipePrefixSearchText] = useState("");

  const swipeGestureStateRef = useRef<SwipeGestureState>(
    createIdleSwipeGestureState(),
  );
  const swipePointerStateRef = useRef<SwipePointerState>(
    createIdleSwipePointerState(),
  );

  const deferredOrderedSwipeThreadIdentifiers = useDeferredValue(
    orderedSwipeThreadIdentifiers,
  );
  const deferredSwipeFilterState = useDeferredValue(sessionState.filterState);
  const deferredSwipeThreadItemsByIdentifier = useDeferredValue(
    sessionState.threadItemsByIdentifier,
  );
  const isSwipeInteractionLocked =
    metadataSyncState.isRunning && !metadataSyncState.isPaused;
  const shouldBuildSwipeFilterOptions = isSwipeFilterModalOpen;

  const swipeQueueSnapshot = useMemo<SwipeQueueSnapshot>(() => {
    const tagCounts = shouldBuildSwipeFilterOptions ? new Map<number, number>() : null;
    const prefixCounts = shouldBuildSwipeFilterOptions
      ? new Map<number, number>()
      : null;

    if (prefixCounts) {
      for (const [prefixIdText] of Object.entries(prefixesMap)) {
        const prefixId = Number(prefixIdText);
        if (Number.isInteger(prefixId)) {
          prefixCounts.set(prefixId, 0);
        }
      }
    }

    let visibleCount = 0;

    for (const threadIdentifier of deferredOrderedSwipeThreadIdentifiers) {
      const threadItem =
        deferredSwipeThreadItemsByIdentifier[String(threadIdentifier)];
      if (!threadItem || !threadMatchesFilter(threadItem, deferredSwipeFilterState)) {
        continue;
      }

      visibleCount += 1;

      if (tagCounts && Array.isArray(threadItem.tags)) {
        for (const tagId of new Set(
          threadItem.tags.filter((tagId) => typeof tagId === "number"),
        )) {
          tagCounts.set(tagId, (tagCounts.get(tagId) ?? 0) + 1);
        }
      }

      if (prefixCounts && Array.isArray(threadItem.prefixes)) {
        for (const prefixId of new Set(
          threadItem.prefixes.filter(
            (prefixId) =>
              typeof prefixId === "number" &&
              typeof prefixesMap[String(prefixId)] === "string",
          ),
        )) {
          prefixCounts.set(prefixId, (prefixCounts.get(prefixId) ?? 0) + 1);
        }
      }
    }

    if (tagCounts) {
      for (const tagId of sessionState.filterState.includeTagIds) {
        if (!tagCounts.has(tagId)) {
          tagCounts.set(tagId, 0);
        }
      }

      for (const tagId of sessionState.filterState.excludeTagIds) {
        if (!tagCounts.has(tagId)) {
          tagCounts.set(tagId, 0);
        }
      }
    }

    if (prefixCounts) {
      for (const prefixId of sessionState.filterState.includePrefixIds) {
        if (!prefixCounts.has(prefixId)) {
          prefixCounts.set(prefixId, 0);
        }
      }

      for (const prefixId of sessionState.filterState.excludePrefixIds) {
        if (!prefixCounts.has(prefixId)) {
          prefixCounts.set(prefixId, 0);
        }
      }
    }

    const tagOptions = tagCounts
      ? Array.from(tagCounts.entries())
          .map(([tagId, count]) => ({
            id: tagId,
            label: tagsMap[String(tagId)] ?? `#${tagId}`,
            count,
          }))
          .sort((first, second) => first.label.localeCompare(second.label, "ru"))
      : [];

    const prefixOptions = prefixCounts
      ? Array.from(prefixCounts.entries())
          .map(([prefixId, count]) => ({
            id: prefixId,
            label: prefixesMap[String(prefixId)] ?? `#${prefixId}`,
            count,
          }))
          .sort((first, second) => first.label.localeCompare(second.label, "ru"))
      : [];

    return {
      visibleCount,
      tagOptions,
      prefixOptions,
    };
  }, [
    deferredOrderedSwipeThreadIdentifiers,
    deferredSwipeFilterState,
    deferredSwipeThreadItemsByIdentifier,
    prefixesMap,
    sessionState.filterState.excludePrefixIds,
    sessionState.filterState.excludeTagIds,
    sessionState.filterState.includePrefixIds,
    sessionState.filterState.includeTagIds,
    shouldBuildSwipeFilterOptions,
    tagsMap,
  ]);

  const visibleSwipeQueueCount = swipeQueueSnapshot.visibleCount;
  const swipeProgressPills = useMemo(() => {
    return [
      { label: "Страниц", value: sessionState.currentPageNumber },
      { label: "В очереди", value: visibleSwipeQueueCount },
      { label: "Просмотрено", value: sessionState.viewedCount },
    ];
  }, [
    sessionState.currentPageNumber,
    sessionState.viewedCount,
    visibleSwipeQueueCount,
  ]);

  const swipeSyncProgressPercent = useMemo(() => {
    if (metadataSyncState.pageLimit <= 0) {
      return null;
    }

    return clamp(
      Math.round(
        (metadataSyncState.currentPage / metadataSyncState.pageLimit) * 100,
      ),
      0,
      100,
    );
  }, [metadataSyncState.currentPage, metadataSyncState.pageLimit]);

  const availableSwipeTagOptions = swipeQueueSnapshot.tagOptions;
  const availableSwipePrefixOptions = swipeQueueSnapshot.prefixOptions;

  const normalizedSwipeTagSearchText = useMemo(
    () => normalizeText(swipeTagSearchText),
    [swipeTagSearchText],
  );

  const normalizedSwipePrefixSearchText = useMemo(
    () => normalizeText(swipePrefixSearchText),
    [swipePrefixSearchText],
  );

  const filteredSwipeTagOptions = useMemo(() => {
    if (!normalizedSwipeTagSearchText) {
      return availableSwipeTagOptions;
    }

    return availableSwipeTagOptions.filter((option) => {
      return (
        normalizeText(option.label).includes(normalizedSwipeTagSearchText) ||
        String(option.id).includes(normalizedSwipeTagSearchText)
      );
    });
  }, [availableSwipeTagOptions, normalizedSwipeTagSearchText]);

  const filteredSwipePrefixOptions = useMemo(() => {
    if (!normalizedSwipePrefixSearchText) {
      return availableSwipePrefixOptions;
    }

    return availableSwipePrefixOptions.filter((option) => {
      return (
        normalizeText(option.label).includes(normalizedSwipePrefixSearchText) ||
        String(option.id).includes(normalizedSwipePrefixSearchText)
      );
    });
  }, [availableSwipePrefixOptions, normalizedSwipePrefixSearchText]);

  const hasActiveSwipeFilterSelections =
    sessionState.filterState.includeTagIds.length > 0 ||
    sessionState.filterState.excludeTagIds.length > 0 ||
    sessionState.filterState.includePrefixIds.length > 0 ||
    sessionState.filterState.excludePrefixIds.length > 0;
  const selectedSwipeFilterCount =
    sessionState.filterState.includeTagIds.length +
    sessionState.filterState.excludeTagIds.length +
    sessionState.filterState.includePrefixIds.length +
    sessionState.filterState.excludePrefixIds.length;
  const selectedSwipePrefixCount =
    sessionState.filterState.includePrefixIds.length +
    sessionState.filterState.excludePrefixIds.length;

  const updateSwipeGestureState = useCallback((nextState: SwipeGestureState) => {
    swipeGestureStateRef.current = nextState;
    setSwipeGestureState(nextState);
  }, []);

  const resetSwipeGesture = useCallback(() => {
    swipePointerStateRef.current = createIdleSwipePointerState();
    updateSwipeGestureState(createIdleSwipeGestureState());
  }, [updateSwipeGestureState]);

  const performSwipeAction = useCallback(
    (action: "favorite" | "trash" | "played") => {
      if (action === "favorite") {
        onFavorite();
        return;
      }

      if (action === "trash") {
        onTrash();
        return;
      }

      onPlayed();
    },
    [onFavorite, onPlayed, onTrash],
  );

  const handlePlayedButtonClick = useCallback(
    (event: ReactMouseEvent<HTMLButtonElement>) => {
      if (event.shiftKey) {
        onPlayedFavorite();
        return;
      }
      onPlayed();
    },
    [onPlayed, onPlayedFavorite],
  );

  const handlePlayedButtonContextMenu = useCallback(
    (event: ReactMouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      onPlayedFavorite();
    },
    [onPlayedFavorite],
  );

  const handleSwipePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (
        !currentThreadItem ||
        isSwipeInteractionLocked ||
        isDownloadModalOpen ||
        isViewerOpen ||
        isSwipeFilterModalOpen
      ) {
        return;
      }

      if (event.pointerType === "mouse" && event.button !== 0) {
        return;
      }

      if (isInteractiveSwipeTarget(event.target)) {
        return;
      }

      swipePointerStateRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
      };

      event.currentTarget.setPointerCapture(event.pointerId);
      updateSwipeGestureState({
        isDragging: true,
        offsetX: 0,
        offsetY: 0,
      });
    },
    [
      currentThreadItem,
      isDownloadModalOpen,
      isSwipeInteractionLocked,
      isSwipeFilterModalOpen,
      isViewerOpen,
      updateSwipeGestureState,
    ],
  );

  const handleSwipePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const activePointerId = swipePointerStateRef.current.pointerId;
      if (activePointerId !== event.pointerId) {
        return;
      }

      const offsetX = event.clientX - swipePointerStateRef.current.startX;
      const rawOffsetY = event.clientY - swipePointerStateRef.current.startY;
      const offsetY = rawOffsetY > 0 ? rawOffsetY * 0.18 : rawOffsetY;

      updateSwipeGestureState({
        isDragging: true,
        offsetX,
        offsetY,
      });
    },
    [updateSwipeGestureState],
  );

  const releaseSwipePointer = useCallback(
    (
      event: ReactPointerEvent<HTMLDivElement>,
      shouldApplyAction: boolean,
    ) => {
      if (swipePointerStateRef.current.pointerId !== event.pointerId) {
        return;
      }

      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }

      const resolvedAction = shouldApplyAction
        ? resolveSwipeActionFromOffset(
            swipeGestureStateRef.current.offsetX,
            swipeGestureStateRef.current.offsetY,
          )
        : null;

      resetSwipeGesture();

      if (resolvedAction) {
        performSwipeAction(resolvedAction);
      }
    },
    [performSwipeAction, resetSwipeGesture],
  );

  const handleSwipePointerUp = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      releaseSwipePointer(event, true);
    },
    [releaseSwipePointer],
  );

  const handleSwipePointerCancel = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      releaseSwipePointer(event, false);
    },
    [releaseSwipePointer],
  );

  const preloadThreadLinks = useMemo(() => {
    const threadLinkList: string[] = [];

    if (currentThreadLink) {
      threadLinkList.push(currentThreadLink);
    }

    for (const threadIdentifier of orderedSwipeThreadIdentifiers) {
      const threadLink = buildThreadLink(threadIdentifier);
      if (threadLinkList.includes(threadLink)) {
        continue;
      }

      threadLinkList.push(threadLink);
      if (threadLinkList.length >= DOWNLOAD_PRELOAD_LIMIT) {
        break;
      }
    }

    return threadLinkList;
  }, [currentThreadLink, orderedSwipeThreadIdentifiers]);

  useEffect(() => {
    if (isSwipeInteractionLocked || preloadThreadLinks.length === 0) {
      return;
    }

    let isCancelled = false;
    const preloadTimeoutId = window.setTimeout(() => {
      void (async () => {
        for (const threadLink of preloadThreadLinks) {
          if (isCancelled || loadCachedThreadDownloads(threadLink)) {
            continue;
          }

          try {
            await loadOrFetchThreadDownloads(threadLink);
          } catch {
            // ignore preload failures
          }
        }
      })();
    }, 450);

    return () => {
      isCancelled = true;
      window.clearTimeout(preloadTimeoutId);
    };
  }, [isSwipeInteractionLocked, preloadThreadLinks]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isSwipeFilterModalOpen) {
        if (event.key === "Escape") {
          event.preventDefault();
          setIsSwipeFilterModalOpen(false);
        }
        return;
      }

      if (isDownloadModalOpen || isCookiePromptOpen || isViewerOpen) {
        return;
      }

      if (isTextInputFocused() || isSwipeInteractionLocked) {
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        onTrash();
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        onFavorite();
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        if (event.shiftKey) {
          onPlayedFavorite();
          return;
        }
        onPlayed();
        return;
      }

      if (event.key === "Enter") {
        if (currentThreadLink) {
          event.preventDefault();
          onOpenCurrentThread();
        }
        return;
      }

      if (event.key === "Backspace" || event.key.toLowerCase() === "z") {
        if (canUndo) {
          event.preventDefault();
          undoLastAction();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    canUndo,
    currentThreadLink,
    isCookiePromptOpen,
    isDownloadModalOpen,
    isSwipeFilterModalOpen,
    isSwipeInteractionLocked,
    isViewerOpen,
    onFavorite,
    onOpenCurrentThread,
    onPlayed,
    onPlayedFavorite,
    onTrash,
    undoLastAction,
  ]);

  useEffect(() => {
    resetSwipeGesture();
  }, [currentThreadIdentifier, isSwipeInteractionLocked, resetSwipeGesture]);

  useEffect(() => {
    if (!isSwipeInteractionLocked || !isSwipeFilterModalOpen) {
      return;
    }

    setIsSwipeFilterModalOpen(false);
  }, [isSwipeFilterModalOpen, isSwipeInteractionLocked]);

  const getTagsForLink = useCallback(
    (threadLink: string) => {
      const processedTags = sessionState.processedThreadItemsByLink[threadLink]?.tags;
      if (Array.isArray(processedTags) && processedTags.length > 0) {
        return processedTags;
      }
      const threadIdentifier = parseThreadIdentifierFromLink(threadLink);
      if (threadIdentifier === null) {
        return [];
      }
      const threadItem = sessionState.threadItemsByIdentifier[String(threadIdentifier)];
      if (!threadItem || !Array.isArray(threadItem.tags)) {
        return [];
      }
      return threadItem.tags;
    },
    [sessionState.processedThreadItemsByLink, sessionState.threadItemsByIdentifier],
  );

  const currentThreadTags = useMemo(() => {
    if (!currentThreadLink) {
      return [];
    }
    return getTagsForLink(currentThreadLink);
  }, [currentThreadLink, getTagsForLink]);

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
  );
  const catalogFeatureStats = useMemo(
    () => buildCatalogFeatureStats(sessionState.threadItemsByIdentifier),
    [sessionState.threadItemsByIdentifier],
  );

  const currentThreadInterestAssessment = useMemo(
    () =>
      assessThreadInterest(
        currentThreadItem,
        interestProfile,
        tagsMap,
        prefixesMap,
        catalogFeatureStats,
      ),
    [
      catalogFeatureStats,
      currentThreadItem,
      interestProfile,
      prefixesMap,
      tagsMap,
    ],
  );

  const toggleSwipeIncludeTag = useCallback(
    (tagId: number) => {
      const hasTag = sessionState.filterState.includeTagIds.includes(tagId);
      const isAtLimit =
        !hasTag &&
        sessionState.filterState.includeTagIds.length >=
          MAX_TAG_FILTERS_PER_GROUP;

      if (isAtLimit) {
        setErrorMessage(
          `Для tags[] можно выбрать максимум ${MAX_TAG_FILTERS_PER_GROUP} тегов.`,
        );
        return;
      }

      const nextIncludeTagIds = hasTag
        ? sessionState.filterState.includeTagIds.filter(
            (value) => value !== tagId,
          )
        : [...sessionState.filterState.includeTagIds, tagId];

      updateFilterState({
        includeTagIds: nextIncludeTagIds,
        excludeTagIds: sessionState.filterState.excludeTagIds.filter(
          (value) => value !== tagId,
        ),
      });
    },
    [
      sessionState.filterState.excludeTagIds,
      sessionState.filterState.includeTagIds,
      setErrorMessage,
      updateFilterState,
    ],
  );

  const toggleSwipeExcludeTag = useCallback(
    (tagId: number) => {
      const hasTag = sessionState.filterState.excludeTagIds.includes(tagId);
      const isAtLimit =
        !hasTag &&
        sessionState.filterState.excludeTagIds.length >=
          MAX_TAG_FILTERS_PER_GROUP;

      if (isAtLimit) {
        setErrorMessage(
          `Для notags[] можно выбрать максимум ${MAX_TAG_FILTERS_PER_GROUP} тегов.`,
        );
        return;
      }

      const nextExcludeTagIds = hasTag
        ? sessionState.filterState.excludeTagIds.filter(
            (value) => value !== tagId,
          )
        : [...sessionState.filterState.excludeTagIds, tagId];

      updateFilterState({
        includeTagIds: sessionState.filterState.includeTagIds.filter(
          (value) => value !== tagId,
        ),
        excludeTagIds: nextExcludeTagIds,
      });
    },
    [
      sessionState.filterState.excludeTagIds,
      sessionState.filterState.includeTagIds,
      setErrorMessage,
      updateFilterState,
    ],
  );

  const toggleSwipeIncludePrefix = useCallback(
    (prefixId: number) => {
      const hasPrefix = sessionState.filterState.includePrefixIds.includes(prefixId);
      const nextIncludePrefixIds = hasPrefix
        ? sessionState.filterState.includePrefixIds.filter(
            (value) => value !== prefixId,
          )
        : [...sessionState.filterState.includePrefixIds, prefixId];

      updateFilterState({
        includePrefixIds: nextIncludePrefixIds,
        excludePrefixIds: sessionState.filterState.excludePrefixIds.filter(
          (value) => value !== prefixId,
        ),
      });
    },
    [
      sessionState.filterState.excludePrefixIds,
      sessionState.filterState.includePrefixIds,
      updateFilterState,
    ],
  );

  const toggleSwipeExcludePrefix = useCallback(
    (prefixId: number) => {
      const hasPrefix = sessionState.filterState.excludePrefixIds.includes(prefixId);
      const nextExcludePrefixIds = hasPrefix
        ? sessionState.filterState.excludePrefixIds.filter(
            (value) => value !== prefixId,
          )
        : [...sessionState.filterState.excludePrefixIds, prefixId];

      updateFilterState({
        includePrefixIds: sessionState.filterState.includePrefixIds.filter(
          (value) => value !== prefixId,
        ),
        excludePrefixIds: nextExcludePrefixIds,
      });
    },
    [
      sessionState.filterState.excludePrefixIds,
      sessionState.filterState.includePrefixIds,
      updateFilterState,
    ],
  );

  const clearSwipeTagFilters = useCallback(() => {
    updateFilterState({
      includeTagIds: [],
      excludeTagIds: [],
      includePrefixIds: [],
      excludePrefixIds: [],
    });
  }, [updateFilterState]);

  const currentThreadFactPills = useMemo(() => {
    if (!currentThreadItem) {
      return [];
    }

    return [
      { label: "Рейтинг", value: String(currentThreadItem.rating ?? 0) },
      { label: "Лайки", value: formatCompactNumber(currentThreadItem.likes) },
      { label: "Просмотры", value: formatCompactNumber(currentThreadItem.views) },
      { label: "Дата", value: formatThreadDateLabel(currentThreadItem.date) },
    ];
  }, [currentThreadItem]);

  const currentThreadStateBadges = useMemo(() => {
    if (!currentThreadItem) {
      return [];
    }

    return [
      currentThreadItem.new ? "New" : null,
      currentThreadItem.watched ? "Watched" : null,
      currentThreadItem.ignored ? "Ignored" : null,
    ].filter((value): value is string => Boolean(value));
  }, [currentThreadItem]);

  const getSwipeTagLabel = useCallback(
    (tagId: number) => tagsMap[String(tagId)] ?? `#${tagId}`,
    [tagsMap],
  );

  const getSwipePrefixLabel = useCallback(
    (prefixId: number) => prefixesMap[String(prefixId)] ?? `#${prefixId}`,
    [prefixesMap],
  );

  const currentThreadPrefixLabels = useMemo(() => {
    if (!currentThreadItem || !Array.isArray(currentThreadItem.prefixes)) {
      return [];
    }

    return Array.from(
      new Set(
        currentThreadItem.prefixes.filter(
          (prefixId): prefixId is number =>
            typeof prefixId === "number" &&
            typeof prefixesMap[String(prefixId)] === "string",
        ),
      ),
    ).map((prefixId) => getSwipePrefixLabel(prefixId));
  }, [currentThreadItem, getSwipePrefixLabel, prefixesMap]);

  const currentThreadInfoCards = useMemo(() => {
    if (!currentThreadItem) {
      return [];
    }

    const creator =
      typeof currentThreadItem.creator === "string"
        ? currentThreadItem.creator.trim()
        : "";
    const version =
      typeof currentThreadItem.version === "string"
        ? currentThreadItem.version.trim()
        : "";

    return [
      { label: "Автор", value: creator || "Не указан" },
      { label: "Версия", value: version ? `v${version}` : "Не указана" },
    ];
  }, [currentThreadItem]);

  const currentThreadPreviewScreens = useMemo(() => {
    if (!currentThreadItem) {
      return [];
    }

    return currentThreadItem.screens;
  }, [currentThreadItem]);

  const swipeDataRequestUrl = useMemo(() => {
    return buildLatestGamesDataRequestUrl(
      1,
      defaultLatestGamesSort,
      defaultFilterState,
    );
  }, [defaultFilterState, defaultLatestGamesSort]);

  const swipeHudAction = useMemo(() => {
    return getSwipeActionCopy(
      resolveSwipeActionFromOffset(
        swipeGestureState.offsetX,
        swipeGestureState.offsetY,
      ),
    );
  }, [swipeGestureState.offsetX, swipeGestureState.offsetY]);

  const swipeCardStyle = useMemo<CSSProperties | undefined>(() => {
    if (!currentThreadItem) {
      return undefined;
    }

    const tilt = clamp(
      swipeGestureState.offsetX / 26,
      -SWIPE_MAX_TILT_DEG,
      SWIPE_MAX_TILT_DEG,
    );

    return {
      transform: `translate3d(${swipeGestureState.offsetX}px, ${swipeGestureState.offsetY}px, 0) rotate(${tilt}deg)`,
      transition: swipeGestureState.isDragging
        ? "none"
        : "transform 180ms ease, box-shadow 180ms ease",
    };
  }, [
    currentThreadItem,
    swipeGestureState.isDragging,
    swipeGestureState.offsetX,
    swipeGestureState.offsetY,
  ]);

  const swipeMetaContent = currentThreadItem ? (
    <div className="swipeMetaBody">
      {currentThreadInterestAssessment ? (
        <div className="swipeInterestPanel">
          <div className="swipeInterestHeader">
            <div className="swipeMetaGroupLabel">Статус интереса</div>
            <span
              className={`swipeInterestBadge swipeInterestBadge${currentThreadInterestAssessment.level[0].toUpperCase()}${currentThreadInterestAssessment.level.slice(1)}`}
            >
              {currentThreadInterestAssessment.label}
            </span>
          </div>

          <div className="swipeInterestSummary">
            {currentThreadInterestAssessment.summary}
          </div>

          {currentThreadInterestAssessment.reasons.length > 0 ? (
            <div className="swipeInterestReasonRow">
              {currentThreadInterestAssessment.reasons.map((reason) => (
                <span
                  key={`${reason.tone}-${reason.text}`}
                  className={`swipeInterestReasonChip swipeInterestReasonChip${reason.tone[0].toUpperCase()}${reason.tone.slice(1)}`}
                >
                  {reason.text}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="gameSettingsInfoGrid swipeMetaInfoGrid">
        {currentThreadInfoCards.map((infoCard) => (
          <div key={infoCard.label} className="gameSettingsInfoCard">
            <div className="gameSettingsInfoLabel">{infoCard.label}</div>
            <div className="gameSettingsInfoValue swipeMetaInfoValue">
              {infoCard.value}
            </div>
          </div>
        ))}
      </div>

      <div className="cardFactRow">
        {currentThreadFactPills.map((fact) => (
          <span key={fact.label} className="cardFactPill">
            {fact.label}: <strong>{fact.value}</strong>
          </span>
        ))}
      </div>

      {currentThreadStateBadges.length > 0 ? (
        <div className="cardStateBadgeRow">
          {currentThreadStateBadges.map((badge) => (
            <span key={badge} className="cardStateBadge">
              {badge}
            </span>
          ))}
        </div>
      ) : null}

      {currentThreadPrefixLabels.length > 0 ? (
        <div className="swipeMetaGroup">
          <div className="swipeMetaGroupLabel">Движок</div>
          <div className="tagChips">
            {currentThreadPrefixLabels.map((prefixLabel) => (
              <span key={prefixLabel} className="tagChip">
                {prefixLabel}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {currentThreadTags.length > 0 ? (
        <div className="swipeMetaGroup">
          <div className="swipeMetaGroupLabel">Теги</div>
          <TagChips tags={currentThreadTags} tagsMap={tagsMap} maxVisible={12} />
        </div>
      ) : null}

      {currentThreadLink ? (
        <div className="swipeMetaLink">{currentThreadLink}</div>
      ) : null}
    </div>
  ) : null;

  return (
    <>
      <div
        className={`swipeScreen ${isSwipeInteractionLocked ? "swipeScreenLocked" : ""}`}
      >
        <div className="swipeSidebar swipeFiltersPanel">
          <div className="swipeSidebarContent">
            <div className="panel swipeSidebarSectionPanel">
              <div className="sectionTitleRow">
                <div className="sectionTitle">Инфо</div>
              </div>

              <div className="swipeSidebarPills">
                {swipeProgressPills.map((pill) => (
                  <span key={pill.label} className="pill">
                    {pill.label}: <strong>{pill.value}</strong>
                  </span>
                ))}
              </div>

              {metadataSyncState.isRunning ? (
                <div className="syncProgressPanel">
                  <div className="syncProgressHeader">
                    <span>
                      {metadataSyncState.isStopping
                        ? "Останавливаю синхронизацию"
                        : metadataSyncState.isPaused
                          ? "Синхронизация на паузе"
                          : "Каталог обновляется в фоне"}
                    </span>
                    <span>
                      {swipeSyncProgressPercent === null
                        ? "..."
                        : `${swipeSyncProgressPercent}%`}
                    </span>
                  </div>
                  <div className="syncProgressTrack">
                    <div
                      className={`syncProgressFill ${
                        swipeSyncProgressPercent === null
                          ? "syncProgressFillIndeterminate"
                          : ""
                      }`}
                      style={
                        swipeSyncProgressPercent === null
                          ? undefined
                          : { width: `${swipeSyncProgressPercent}%` }
                      }
                    />
                  </div>
                </div>
              ) : null}

              {metadataSyncState.isRunning ? (
                <div className="swipeSessionActions">
                  <button
                    className="button"
                    type="button"
                    onClick={
                      metadataSyncState.isPaused
                        ? onResumeMetadataSync
                        : onPauseMetadataSync
                    }
                    disabled={metadataSyncState.isStopping}
                  >
                    {metadataSyncState.isPaused ? "Продолжить" : "Пауза"}
                  </button>
                  <button
                    className="button buttonDanger"
                    type="button"
                    onClick={onStopMetadataSync}
                    disabled={metadataSyncState.isStopping}
                  >
                    {metadataSyncState.isStopping ? "Останавливаю..." : "Стоп"}
                  </button>
                </div>
              ) : null}
            </div>

            <div className="panel swipeSidebarSectionPanel swipeFilterSection">
              <div className="sectionTitleRow">
                <div className="sectionTitle">Поиск и фильтры</div>
                <button
                  className="button"
                  type="button"
                  disabled={isSwipeInteractionLocked}
                  onClick={resetFilterState}
                >
                  Сбросить
                </button>
              </div>

              <div className="formRow" style={{ marginBottom: 0 }}>
                <div className="label">Поиск по title/creator</div>
                <input
                  className="input"
                  disabled={isSwipeInteractionLocked}
                  value={sessionState.filterState.searchText}
                  onChange={(event) =>
                    updateFilterState({ searchText: event.target.value })
                  }
                  placeholder="например: team18"
                />
              </div>

              <div className="formRow" style={{ marginBottom: 0 }}>
                <div className="label">Источник latest_data</div>
                <select
                  className="input"
                  disabled={isSwipeInteractionLocked}
                  value={sessionState.latestGamesSort}
                  onChange={(event) =>
                    setLatestGamesSort(
                      event.target.value === "views" ? "views" : "date",
                    )
                  }
                >
                  {SWIPE_SORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="formRow" style={{ marginBottom: 0 }}>
                <div className="label">Порядок карточек</div>
                <select
                  className="input"
                  disabled={isSwipeInteractionLocked}
                  value={sessionState.swipeSortMode}
                  onChange={(event) =>
                    setSwipeSortMode(
                      event.target.value === "interest"
                        ? "interest"
                        : event.target.value === "views"
                          ? "views"
                          : "date",
                    )
                  }
                >
                  {SWIPE_ORDER_OPTIONS.map((option) => (
                    <option key={`order-${option.value}`} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sectionTitleRow">
                <div className="sectionTitle">Фильтры</div>
                <div className="sectionMeta">
                  Выбрано: {selectedSwipeFilterCount}
                </div>
              </div>

              <div className="swipeFilterTriggerRow">
                <button
                  className="button buttonPrimary"
                  type="button"
                  disabled={isSwipeInteractionLocked}
                  onClick={() => setIsSwipeFilterModalOpen(true)}
                >
                  Открыть фильтры
                </button>

                {hasActiveSwipeFilterSelections ? (
                  <button
                    className="button"
                    type="button"
                    disabled={isSwipeInteractionLocked}
                    onClick={clearSwipeTagFilters}
                  >
                    Очистить
                  </button>
                ) : null}
              </div>

              {hasActiveSwipeFilterSelections ? (
                <div className="swipeTagSelectionSummary">
                  {sessionState.filterState.includePrefixIds.length > 0 ? (
                    <div className="swipeTagSelectionGroup">
                      <div className="swipeTagSelectionLabel">prefixes[]</div>
                      <div className="tagFilterChips">
                        {sessionState.filterState.includePrefixIds.map((prefixId) => (
                          <button
                            key={`selected-prefix-include-${prefixId}`}
                            type="button"
                            className="tagFilterChip tagFilterChipActive"
                            disabled={isSwipeInteractionLocked}
                            onClick={() => toggleSwipeIncludePrefix(prefixId)}
                          >
                            {getSwipePrefixLabel(prefixId)}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {sessionState.filterState.excludePrefixIds.length > 0 ? (
                    <div className="swipeTagSelectionGroup">
                      <div className="swipeTagSelectionLabel">noprefixes[]</div>
                      <div className="tagFilterChips">
                        {sessionState.filterState.excludePrefixIds.map((prefixId) => (
                          <button
                            key={`selected-prefix-exclude-${prefixId}`}
                            type="button"
                            className="tagFilterChip tagFilterChipExcludeActive"
                            disabled={isSwipeInteractionLocked}
                            onClick={() => toggleSwipeExcludePrefix(prefixId)}
                          >
                            {getSwipePrefixLabel(prefixId)}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {sessionState.filterState.includeTagIds.length > 0 ? (
                    <div className="swipeTagSelectionGroup">
                      <div className="swipeTagSelectionLabel">
                        tags[] {sessionState.filterState.includeTagIds.length}/
                        {MAX_TAG_FILTERS_PER_GROUP}
                      </div>
                      <div className="tagFilterChips">
                        {sessionState.filterState.includeTagIds.map((tagId) => (
                          <button
                            key={`selected-include-${tagId}`}
                            type="button"
                            className="tagFilterChip tagFilterChipActive"
                            disabled={isSwipeInteractionLocked}
                            onClick={() => toggleSwipeIncludeTag(tagId)}
                          >
                            {getSwipeTagLabel(tagId)}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {sessionState.filterState.excludeTagIds.length > 0 ? (
                    <div className="swipeTagSelectionGroup">
                      <div className="swipeTagSelectionLabel">
                        notags[] {sessionState.filterState.excludeTagIds.length}/
                        {MAX_TAG_FILTERS_PER_GROUP}
                      </div>
                      <div className="tagFilterChips">
                        {sessionState.filterState.excludeTagIds.map((tagId) => (
                          <button
                            key={`selected-exclude-${tagId}`}
                            type="button"
                            className="tagFilterChip tagFilterChipExcludeActive"
                            disabled={isSwipeInteractionLocked}
                            onClick={() => toggleSwipeExcludeTag(tagId)}
                          >
                            {getSwipeTagLabel(tagId)}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {swipeDataRequestUrl ? (
                <div className="swipeDataRequestBlock">
                  <button
                    className="swipeDataRequestLabelButton"
                    type="button"
                    onClick={() => {
                      openLinkInNewTab(swipeDataRequestUrl);
                    }}
                  >
                    Источник latest_data.php
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="swipeCenterColumn">
          {isSwipeInteractionLocked ? (
            <div className="statusBox swipeStatusBox">
              <div style={{ fontWeight: 900, fontSize: 20 }}>
                Свайп временно заблокирован
              </div>
              <div className="mutedText">
                {metadataSyncState.isStopping
                  ? "Синхронизация завершает текущий проход. Свайп откроется сразу после остановки."
                  : "Каталог обновляется. Карточки снова станут доступны после завершения синхронизации или после паузы."}
              </div>
              <div className="syncProgressPanel">
                <div className="syncProgressHeader">
                  <span>
                    Страница {metadataSyncState.currentPage || 0}
                    {metadataSyncState.pageLimit > 0
                      ? ` из ${metadataSyncState.pageLimit}`
                      : ""}
                  </span>
                  <span>
                    {swipeSyncProgressPercent === null
                      ? "..."
                      : `${swipeSyncProgressPercent}%`}
                  </span>
                </div>
                <div className="syncProgressTrack">
                  <div
                    className={`syncProgressFill ${
                      swipeSyncProgressPercent === null
                        ? "syncProgressFillIndeterminate"
                        : ""
                    }`}
                    style={
                      swipeSyncProgressPercent === null
                        ? undefined
                        : { width: `${swipeSyncProgressPercent}%` }
                    }
                  />
                </div>
              </div>
              <div className="smallText">
                Сохранено в каталог: {metadataSyncState.syncedCount}. Обновлено
                отслеживаемых: {metadataSyncState.updatedTrackedCount}.
              </div>
            </div>
          ) : !currentThreadItem ? (
            <div className="statusBox">
              <div style={{ fontWeight: 900, fontSize: 20 }}>
                {isLoadingPage ? "Синхронизация latest..." : "Нет карточек для показа"}
              </div>
              <div className="mutedText">
                Если включены фильтры, возможно, они отфильтровали все. Попробуй
                сбросить фильтры.
              </div>
            </div>
          ) : (
            <div className="cardDeck swipeCardDeck">
              <div
                className={`card cardCurrent swipeFocusCard ${
                  swipeGestureState.isDragging ? "cardCurrentDragging" : ""
                }`}
                data-swipe-action={swipeHudAction?.className ?? ""}
                style={swipeCardStyle}
              >
                <div className="swipeFocusCardHeader" data-no-swipe="true">
                  <div className="swipeFocusCardTitleBlock">
                    <div className="swipeFocusCardTitle">{currentThreadItem.title}</div>
                  </div>
                </div>

                <div className="swipeFocusCardBody">
                  <div className="swipeHeroPanel swipeScrollablePanel" data-no-swipe="true">
                    <div className="swipeHeroScrollArea swipeHiddenScrollbar">
                      <div
                        className="cardGestureSurface swipeCoverGestureSurface"
                        onPointerDown={handleSwipePointerDown}
                        onPointerMove={handleSwipePointerMove}
                        onPointerUp={handleSwipePointerUp}
                        onPointerCancel={handleSwipePointerCancel}
                      >
                        <div className="coverImageBack swipeHeroCover">
                          {currentThreadItem.cover ? (
                            <img
                              className="coverImage swipeHeroImage"
                              src={currentThreadItem.cover}
                              alt="cover"
                              loading="eager"
                              onClick={() =>
                                onOpenViewer(
                                  [currentThreadItem.cover, ...currentThreadItem.screens],
                                  0,
                                )
                              }
                            />
                          ) : (
                            <div className="coverImageFallback">Нет обложки</div>
                          )}
                        </div>
                      </div>

                      <div className="swipeHeroMeta">
                        <button
                          className="button buttonPrimary swipeOpenThreadButton"
                          type="button"
                          onClick={onOpenCurrentThread}
                          onMouseDown={(event) => {
                            if (event.button === 1) {
                              event.preventDefault();
                            }
                          }}
                          onAuxClick={(event) => {
                            if (event.button !== 1) {
                              return;
                            }

                            event.preventDefault();
                            onOpenCurrentThreadInBackground();
                          }}
                          disabled={!currentThreadLink}
                        >
                          Открыть страницу
                        </button>

                        {swipeMetaContent}
                      </div>
                    </div>
                  </div>

                  <div className="swipeScreensPanel swipeScrollablePanel" data-no-swipe="true">
                    <div className="swipeScreensScrollArea swipeHiddenScrollbar">
                      {currentThreadPreviewScreens.length > 0 ? (
                        <div className="swipeCompactScreens">
                          {currentThreadPreviewScreens.map((screenUrl, index) => (
                            <button
                              key={screenUrl}
                              type="button"
                              className="swipeScreenTile"
                              onClick={() => onOpenViewer(currentThreadItem.screens, index)}
                            >
                              <img
                                className="screenImage swipeCompactScreenImage"
                                src={screenUrl}
                                alt="screen"
                                loading="lazy"
                              />
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="swipeScreensEmpty">Нет скриншотов</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {!isSwipeInteractionLocked ? (
          <div className="panel swipeActionSidebar">
            <button
              className={`button swipeSideActionButton swipeActionTrash ${
                swipeHudAction?.className === "trash"
                  ? "swipeSideActionButtonActive"
                  : ""
              }`}
              type="button"
              onClick={onTrash}
              disabled={!currentThreadItem}
            >
              <span className="swipeActionIcon" aria-hidden>
                🗑
              </span>
              <span className="swipeActionLabel">В мусор</span>
              <span className="swipeActionHint">Left</span>
            </button>
            <button
              className={`button swipeSideActionButton swipeActionPlayed ${
                swipeHudAction?.className === "played"
                  ? "swipeSideActionButtonActive"
                  : ""
              }`}
              type="button"
              onClick={handlePlayedButtonClick}
              onContextMenu={handlePlayedButtonContextMenu}
              disabled={!currentThreadItem}
              title="Клик: Играл. Shift + клик или правая кнопка мыши: Играл (любимое)"
              aria-label="Играл. Shift + клик или правая кнопка мыши: Играл в любимое"
            >
              <span className="swipeActionIcon" aria-hidden>
                🎮
              </span>
              <span className="swipeActionLabel">Играл</span>
              <span className="swipeActionHint">Up • Shift / ПКМ = ♥</span>
            </button>
            <button
              className={`button swipeSideActionButton swipeActionFavorite ${
                swipeHudAction?.className === "favorite"
                  ? "swipeSideActionButtonActive"
                  : ""
              }`}
              type="button"
              onClick={onFavorite}
              disabled={!currentThreadItem}
            >
              <span className="swipeActionIcon" aria-hidden>
                ★
              </span>
              <span className="swipeActionLabel">В закладки</span>
              <span className="swipeActionHint">Right</span>
            </button>
            <button
              className="button swipeSideActionButton swipeActionUndo"
              type="button"
              onClick={undoLastAction}
              disabled={!canUndo}
            >
              <span className="swipeActionIcon" aria-hidden>
                ↶
              </span>
              <span className="swipeActionLabel">Назад</span>
              <span className="swipeActionHint">Backspace / Z</span>
            </button>
          </div>
        ) : null}
      </div>

      <SwipeFilterModal
        isOpen={isSwipeFilterModalOpen}
        isInteractionLocked={isSwipeInteractionLocked}
        swipePrefixSearchText={swipePrefixSearchText}
        swipeTagSearchText={swipeTagSearchText}
        filteredSwipePrefixOptions={filteredSwipePrefixOptions}
        filteredSwipeTagOptions={filteredSwipeTagOptions}
        selectedSwipePrefixCount={selectedSwipePrefixCount}
        includePrefixIds={sessionState.filterState.includePrefixIds}
        excludePrefixIds={sessionState.filterState.excludePrefixIds}
        includeTagIds={sessionState.filterState.includeTagIds}
        excludeTagIds={sessionState.filterState.excludeTagIds}
        onClose={() => setIsSwipeFilterModalOpen(false)}
        onClearFilters={clearSwipeTagFilters}
        onSwipePrefixSearchTextChange={setSwipePrefixSearchText}
        onSwipeTagSearchTextChange={setSwipeTagSearchText}
        onToggleSwipeIncludePrefix={toggleSwipeIncludePrefix}
        onToggleSwipeExcludePrefix={toggleSwipeExcludePrefix}
        onToggleSwipeIncludeTag={toggleSwipeIncludeTag}
        onToggleSwipeExcludeTag={toggleSwipeExcludeTag}
      />
    </>
  );
};

export { SwipePage };
