import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useF95Browser } from "./f95/useF95Browser";
import {
  buildThreadLink,
  isLikelyCookieRefreshErrorMessage,
} from "./f95/api";
import {
  clearHiddenDownloadHosts,
  clearDisabledDownloadHosts,
  clearAllCachedThreadDownloads,
  disableDownloadHostTemporarily,
  enableDownloadHost,
  findBestDownloadLink,
  loadCachedThreadDownloads,
  loadDisabledDownloadHosts,
  loadHiddenDownloadHosts,
  loadKnownDownloadHosts,
  loadOrFetchThreadDownloads,
  loadPreferredDownloadHosts,
  moveDownloadHostPreference,
  removeCachedThreadDownloads,
  resetPreferredDownloadHosts,
  savePreferredDownloadHosts,
  sortDownloadHostsByPreference,
  hideDownloadHost,
  showDownloadHost,
} from "./f95/downloads";
import { countUpdatedTrackedItems } from "./f95/updateTracking";
import { downloadJsonFile, readFileAsText, safeJsonParse } from "./f95/utils";
import { normalizeSessionState, normalizeTagsMap, saveSessionState, saveTagsMap } from "./f95/storage";
import type { ListType, ProcessedThreadItem, ThreadDownloadsData } from "./f95/types";
import { Dashboard } from "./components/Dashboard";
import { DownloadModal } from "./components/DownloadModal";
import { SettingsPage, type SettingsTab } from "./components/SettingsPage";
import { TagChips } from "./components/TagChips";

const openLinkInNewTab = (link: string) => {
  window.open(link, "_blank", "noopener,noreferrer");
};

const DOWNLOAD_PRELOAD_LIMIT = 4;

const isTextInputFocused = () => {
  const activeElement = document.activeElement;
  if (!activeElement) {
    return false;
  }

  const elementTagName = activeElement.tagName;
  if (
    elementTagName === "INPUT" ||
    elementTagName === "TEXTAREA" ||
    elementTagName === "SELECT"
  ) {
    return true;
  }

  return false;
};

type ViewerState = {
  isOpen: boolean;
  imageUrlList: string[];
  activeIndex: number;
};

const createClosedViewerState = (): ViewerState => ({
  isOpen: false,
  imageUrlList: [],
  activeIndex: 0,
});

type DownloadModalState = {
  isOpen: boolean;
  threadLink: string | null;
  threadTitle: string;
  downloadsData: ThreadDownloadsData | null;
  isLoading: boolean;
  errorMessage: string | null;
};

const createClosedDownloadModalState = (): DownloadModalState => ({
  isOpen: false,
  threadLink: null,
  threadTitle: "",
  downloadsData: null,
  isLoading: false,
  errorMessage: null,
});

type PageType = "swipe" | "dashboard" | "settings";

const readHashRoute = () => {
  const rawHashValue = window.location.hash.replace("#", "").trim().toLowerCase();
  const [pageValue, queryValue = ""] = rawHashValue.split("?");

  return {
    pageValue,
    searchParams: new URLSearchParams(queryValue),
  };
};

const readPageFromHash = (): PageType => {
  const { pageValue } = readHashRoute();
  if (pageValue === "dashboard") {
    return "dashboard";
  }
  if (pageValue === "settings") {
    return "settings";
  }
  return "swipe";
};

const isSettingsTab = (value: string | null): value is SettingsTab => {
  return (
    value === "hosts" ||
    value === "cookies" ||
    value === "tags" ||
    value === "data"
  );
};

const readSettingsTabFromHash = (): SettingsTab | null => {
  const { pageValue, searchParams } = readHashRoute();
  if (pageValue !== "settings") {
    return null;
  }

  const requestedTab = searchParams.get("tab");
  return isSettingsTab(requestedTab) ? requestedTab : null;
};

const buildHashForPage = (
  nextPageType: PageType,
  nextSettingsTab: SettingsTab | null = null,
) => {
  if (nextPageType === "dashboard") {
    return "#dashboard";
  }

  if (nextPageType === "settings") {
    return nextSettingsTab ? `#settings?tab=${nextSettingsTab}` : "#settings";
  }

  return "#swipe";
};

const parseThreadIdentifierFromLink = (threadLink: string) => {
  const match = /\/threads\/(\d+)/.exec(threadLink);
  if (!match) {
    return null;
  }
  return Number(match[1]);
};

const pickCoverForLink = (
  threadLink: string,
  processedThreadItemsByLink: Record<string, ProcessedThreadItem>,
  threadItemsByIdentifier: Record<string, { cover?: string }>,
) => {
  const processedItem = processedThreadItemsByLink[threadLink];
  if (processedItem?.cover) {
    return processedItem.cover;
  }

  const threadIdentifier = parseThreadIdentifierFromLink(threadLink);
  if (threadIdentifier === null) {
    return "";
  }

  const threadItem = threadItemsByIdentifier[String(threadIdentifier)];
  return typeof threadItem?.cover === "string" ? threadItem.cover : "";
};

const pickTitleForLink = (
  threadLink: string,
  processedThreadItemsByLink: Record<string, ProcessedThreadItem>,
  threadItemsByIdentifier: Record<string, { title?: string }>,
) => {
  const processedItem = processedThreadItemsByLink[threadLink];
  if (processedItem?.title) {
    return processedItem.title;
  }

  const threadIdentifier = parseThreadIdentifierFromLink(threadLink);
  if (threadIdentifier === null) {
    return threadLink;
  }

  const threadItem = threadItemsByIdentifier[String(threadIdentifier)];
  return typeof threadItem?.title === "string"
    ? threadItem.title
    : `Thread ${threadIdentifier}`;
};

const pickCreatorForLink = (
  threadLink: string,
  processedThreadItemsByLink: Record<string, ProcessedThreadItem>,
  threadItemsByIdentifier: Record<string, { creator?: string }>,
) => {
  const processedItem = processedThreadItemsByLink[threadLink];
  if (processedItem?.creator) {
    return processedItem.creator;
  }

  const threadIdentifier = parseThreadIdentifierFromLink(threadLink);
  if (threadIdentifier === null) {
    return "Unknown";
  }

  const threadItem = threadItemsByIdentifier[String(threadIdentifier)];
  return typeof threadItem?.creator === "string"
    ? threadItem.creator
    : "Unknown";
};

const pickRatingForLink = (
  threadLink: string,
  processedThreadItemsByLink: Record<string, ProcessedThreadItem>,
  threadItemsByIdentifier: Record<string, { rating?: number }>,
) => {
  const processedItem = processedThreadItemsByLink[threadLink];
  if (typeof processedItem?.rating === "number") {
    return processedItem.rating;
  }

  const threadIdentifier = parseThreadIdentifierFromLink(threadLink);
  if (threadIdentifier === null) {
    return 0;
  }

  const threadItem = threadItemsByIdentifier[String(threadIdentifier)];
  return typeof threadItem?.rating === "number" ? threadItem.rating : 0;
};

const App = () => {
  const {
    sessionState,
    currentThreadIdentifier,
    currentThreadItem,
    isLoadingPage,
    errorMessage,
    canUndo,
    applyActionToCurrentCard,
    undoLastAction,
    updateFilterState,
    resetFilterState,
    clearAllData,
    setErrorMessage,
    tagsMap,
    updateTagsMap,
    metadataSyncState,
    startMetadataSync,
    moveLinkToList,
    removeLinkFromList,
  } = useF95Browser();

  const [viewerState, setViewerState] = useState<ViewerState>(() =>
    createClosedViewerState(),
  );
  const [downloadModalState, setDownloadModalState] =
    useState<DownloadModalState>(() => createClosedDownloadModalState());
  const [pageType, setPageType] = useState<PageType>(() => readPageFromHash());
  const [requestedSettingsTab, setRequestedSettingsTab] =
    useState<SettingsTab | null>(() => readSettingsTabFromHash());
  const [preferredDownloadHosts, setPreferredDownloadHosts] = useState<string[]>(
    () => loadPreferredDownloadHosts(),
  );
  const [disabledDownloadHosts, setDisabledDownloadHosts] = useState<Record<string, number>>(
    () => loadDisabledDownloadHosts(),
  );
  const [hiddenDownloadHosts, setHiddenDownloadHosts] = useState<string[]>(
    () => loadHiddenDownloadHosts(),
  );

  const importSessionStateInputRef = useRef<HTMLInputElement | null>(null);
  const importTagsMapInputRef = useRef<HTMLInputElement | null>(null);
  const downloadRequestIdRef = useRef(0);

  const currentThreadLink = useMemo(() => {
    if (currentThreadIdentifier === null) {
      return null;
    }
    return buildThreadLink(currentThreadIdentifier);
  }, [currentThreadIdentifier]);

  const playedLinks = useMemo(
    () => sessionState.playedLinks,
    [sessionState.playedLinks],
  );

  const playedCount = useMemo(
    () => playedLinks.length,
    [playedLinks],
  );

  const swipeProgressPills = useMemo(() => {
    return [
      { label: "Страница", value: sessionState.currentPageNumber },
      {
        label: "В очереди",
        value: sessionState.remainingThreadIdentifiers.length,
      },
      { label: "Просмотрено", value: sessionState.viewedCount },
    ];
  }, [
    sessionState.currentPageNumber,
    sessionState.remainingThreadIdentifiers.length,
    sessionState.viewedCount,
  ]);

  const handleMoveDownloadHost = useCallback(
    (hostLabel: string, direction: -1 | 1) => {
      setPreferredDownloadHosts((previousState) => {
        const orderedHostList = sortDownloadHostsByPreference(
          loadKnownDownloadHosts(),
          previousState,
        );
        const currentIndex = orderedHostList.indexOf(hostLabel);
        if (currentIndex === -1) {
          return previousState;
        }

        let targetIndex = currentIndex + direction;
        while (
          targetIndex >= 0 &&
          targetIndex < orderedHostList.length &&
          hiddenDownloadHosts.includes(orderedHostList[targetIndex])
        ) {
          targetIndex += direction;
        }

        if (targetIndex < 0 || targetIndex >= orderedHostList.length) {
          return previousState;
        }

        const nextState = moveDownloadHostPreference(
          orderedHostList,
          hostLabel,
          targetIndex,
        );
        savePreferredDownloadHosts(nextState);
        return nextState;
      });
    },
    [hiddenDownloadHosts],
  );

  const handleDisableDownloadHostTemporarily = useCallback((hostLabel: string) => {
    setDisabledDownloadHosts(disableDownloadHostTemporarily(hostLabel));
  }, []);

  const handleEnableDownloadHost = useCallback((hostLabel: string) => {
    setDisabledDownloadHosts(enableDownloadHost(hostLabel));
  }, []);

  const handleResetPreferredDownloadHosts = useCallback(() => {
    const nextHostList = resetPreferredDownloadHosts();
    setPreferredDownloadHosts(nextHostList);
  }, []);

  const handleClearDisabledDownloadHosts = useCallback(() => {
    clearDisabledDownloadHosts();
    setDisabledDownloadHosts({});
  }, []);

  const handleHideDownloadHost = useCallback((hostLabel: string) => {
    setHiddenDownloadHosts(hideDownloadHost(hostLabel));
  }, []);

  const handleShowDownloadHost = useCallback((hostLabel: string) => {
    setHiddenDownloadHosts(showDownloadHost(hostLabel));
  }, []);

  const handleClearHiddenDownloadHosts = useCallback(() => {
    clearHiddenDownloadHosts();
    setHiddenDownloadHosts([]);
  }, []);

  const removeDownloadCacheForListType = useCallback(
    (threadLink: string, listType: ListType) => {
      if (listType === "trash" || listType === "played") {
        removeCachedThreadDownloads(threadLink);
      }
    },
    [],
  );

  const handleFavorite = useCallback(() => {
    applyActionToCurrentCard("favorite");
  }, [applyActionToCurrentCard]);

  const handleTrash = useCallback(() => {
    if (currentThreadLink) {
      removeCachedThreadDownloads(currentThreadLink);
    }
    applyActionToCurrentCard("trash");
  }, [applyActionToCurrentCard, currentThreadLink]);

  const handlePlayed = useCallback(() => {
    if (currentThreadLink) {
      removeCachedThreadDownloads(currentThreadLink);
    }
    applyActionToCurrentCard("played");
  }, [applyActionToCurrentCard, currentThreadLink]);

  const handleExportSessionState = useCallback(() => {
    downloadJsonFile("f95-tinder-session.json", {
      sessionState,
      tagsMap,
    });
  }, [sessionState, tagsMap]);

  const handleImportSessionStateChange = useCallback(async () => {
    const inputElement = importSessionStateInputRef.current;
    const file = inputElement?.files?.[0];
    if (!file) {
      return;
    }

    try {
      setErrorMessage(null);
      const fileText = await readFileAsText(file);
      const parsedJson = safeJsonParse<unknown>(fileText);

      if (
        !parsedJson ||
        typeof parsedJson !== "object" ||
        Array.isArray(parsedJson)
      ) {
        throw new Error("Импорт: ожидается объект с данными сессии");
      }

      const parsedValue = parsedJson as Record<string, unknown>;
      const nextSessionState = normalizeSessionState(parsedValue.sessionState);
      if (!nextSessionState) {
        throw new Error("Импорт: sessionState имеет неверный формат");
      }

      const nextTagsMap = normalizeTagsMap(parsedValue.tagsMap);

      saveSessionState(nextSessionState);
      saveTagsMap(nextTagsMap);
      window.location.reload();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Ошибка импорта",
      );
    } finally {
      if (inputElement) {
        inputElement.value = "";
      }
    }
  }, [
    normalizeSessionState,
    normalizeTagsMap,
    saveSessionState,
    saveTagsMap,
    setErrorMessage,
  ]);

  const handleImportTagsMapChange = useCallback(async () => {
    const inputElement = importTagsMapInputRef.current;
    const file = inputElement?.files?.[0];
    if (!file) {
      return;
    }

    try {
      const fileText = await readFileAsText(file);
      const parsedJson = safeJsonParse<unknown>(fileText);

      if (
        !parsedJson ||
        typeof parsedJson !== "object" ||
        Array.isArray(parsedJson)
      ) {
        throw new Error("Импорт: ожидается объект тегов");
      }

      const normalized: Record<string, string> = {};
      for (const key of Object.keys(parsedJson)) {
        const value = (parsedJson as Record<string, unknown>)[key];
        if (typeof value === "string") {
          normalized[key] = value;
        }
      }

      updateTagsMap(normalized);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Ошибка импорта тегов",
      );
    } finally {
      if (inputElement) {
        inputElement.value = "";
      }
    }
  }, [setErrorMessage, updateTagsMap]);

  const handleImportBundledTagsMap = useCallback(async () => {
    try {
      setErrorMessage(null);

      const response = await fetch("/tags.json", {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(
          `Не удалось загрузить встроенные теги: ${response.status}`,
        );
      }

      const parsedJson = (await response.json()) as unknown;
      const normalizedTagsMap = normalizeTagsMap(parsedJson);

      if (Object.keys(normalizedTagsMap).length === 0) {
        throw new Error("Встроенный tags.json пустой или имеет неверный формат");
      }

      updateTagsMap(normalizedTagsMap);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Ошибка загрузки встроенных тегов",
      );
    }
  }, [normalizeTagsMap, setErrorMessage, updateTagsMap]);

  const openViewer = useCallback(
    (imageUrlList: string[], startIndex: number) => {
      setViewerState({ isOpen: true, imageUrlList, activeIndex: startIndex });
    },
    [],
  );

  const closeViewer = useCallback(() => {
    setViewerState(createClosedViewerState());
  }, []);

  const closeDownloadModal = useCallback(() => {
    downloadRequestIdRef.current += 1;
    setDownloadModalState(createClosedDownloadModalState());
  }, []);

  const showDownloadModal = useCallback(
    (
      threadLink: string,
      threadTitle: string,
      downloadsData: ThreadDownloadsData | null,
      isLoading: boolean,
      errorMessageValue: string | null,
    ) => {
      setDownloadModalState({
        isOpen: true,
        threadLink,
        threadTitle,
        downloadsData,
        isLoading,
        errorMessage: errorMessageValue,
      });
    },
    [],
  );

  const openDownloadModal = useCallback(
    async (threadLink: string, threadTitle: string) => {
      const cachedDownloads = loadCachedThreadDownloads(threadLink);
      const requestId = downloadRequestIdRef.current + 1;
      downloadRequestIdRef.current = requestId;

      if (cachedDownloads) {
        showDownloadModal(
          threadLink,
          threadTitle,
          cachedDownloads,
          false,
          null,
        );
        return;
      }

      showDownloadModal(threadLink, threadTitle, null, true, null);

      try {
        const downloadsData = await loadOrFetchThreadDownloads(threadLink);

        if (downloadRequestIdRef.current !== requestId) {
          return;
        }

        showDownloadModal(threadLink, threadTitle, downloadsData, false, null);
      } catch (error) {
        if (downloadRequestIdRef.current !== requestId) {
          return;
        }

        showDownloadModal(
          threadLink,
          threadTitle,
          null,
          false,
          error instanceof Error
            ? error.message
            : "Не удалось загрузить download links",
        );
      }
    },
    [showDownloadModal],
  );

  const openCurrentThreadDownloads = useCallback(() => {
    if (!currentThreadLink || !currentThreadItem) {
      return;
    }

    void openDownloadModal(currentThreadLink, currentThreadItem.title);
  }, [currentThreadItem, currentThreadLink, openDownloadModal]);

  const openBestDownloadForThread = useCallback(
    async (threadLink: string, threadTitle: string) => {
      try {
        const downloadsData = await loadOrFetchThreadDownloads(threadLink);
        const bestDownloadLink = findBestDownloadLink(
          downloadsData,
          preferredDownloadHosts,
          disabledDownloadHosts,
          hiddenDownloadHosts,
        );

        if (bestDownloadLink?.url) {
          openLinkInNewTab(bestDownloadLink.url);
          return;
        }

        showDownloadModal(threadLink, threadTitle, downloadsData, false, null);
      } catch (error) {
        showDownloadModal(
          threadLink,
          threadTitle,
          null,
          false,
          error instanceof Error
            ? error.message
            : "Не удалось загрузить download links",
        );
      }
    },
    [
      disabledDownloadHosts,
      hiddenDownloadHosts,
      preferredDownloadHosts,
      showDownloadModal,
    ],
  );

  const openCurrentBestDownload = useCallback(() => {
    if (!currentThreadLink || !currentThreadItem) {
      return;
    }

    void openBestDownloadForThread(currentThreadLink, currentThreadItem.title);
  }, [currentThreadItem, currentThreadLink, openBestDownloadForThread]);

  const showPreviousViewerImage = useCallback(() => {
    setViewerState((previousState) => {
      if (!previousState.isOpen || previousState.imageUrlList.length === 0) {
        return previousState;
      }

      const nextIndex =
        previousState.activeIndex <= 0
          ? previousState.imageUrlList.length - 1
          : previousState.activeIndex - 1;

      return { ...previousState, activeIndex: nextIndex };
    });
  }, []);

  const showNextViewerImage = useCallback(() => {
    setViewerState((previousState) => {
      if (!previousState.isOpen || previousState.imageUrlList.length === 0) {
        return previousState;
      }

      const nextIndex =
        previousState.activeIndex >= previousState.imageUrlList.length - 1
          ? 0
          : previousState.activeIndex + 1;

      return { ...previousState, activeIndex: nextIndex };
    });
  }, []);

  const setPage = useCallback((
    nextPageType: PageType,
    nextSettingsTab: SettingsTab | null = null,
  ) => {
    setPageType(nextPageType);
    setRequestedSettingsTab(
      nextPageType === "settings" ? nextSettingsTab : null,
    );
    window.location.hash = buildHashForPage(nextPageType, nextSettingsTab);
  }, []);

  const openSettingsPage = useCallback(() => {
    closeDownloadModal();
    setPage("settings");
  }, [closeDownloadModal, setPage]);

  const preloadThreadLinks = useMemo(() => {
    const threadLinkList: string[] = [];

    if (currentThreadLink) {
      threadLinkList.push(currentThreadLink);
    }

    for (const threadIdentifier of sessionState.remainingThreadIdentifiers) {
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
  }, [currentThreadLink, sessionState.remainingThreadIdentifiers]);

  useEffect(() => {
    const handleHashChange = () => {
      setPageType(readPageFromHash());
      setRequestedSettingsTab(readSettingsTabFromHash());
    };

    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  useEffect(() => {
    if (pageType !== "swipe" || preloadThreadLinks.length === 0) {
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
  }, [pageType, preloadThreadLinks]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (downloadModalState.isOpen) {
        if (event.key === "Escape") {
          event.preventDefault();
          closeDownloadModal();
        }
        return;
      }

      if (viewerState.isOpen) {
        if (event.key === "Escape") {
          event.preventDefault();
          closeViewer();
          return;
        }

        if (event.key === "ArrowLeft") {
          event.preventDefault();
          showPreviousViewerImage();
          return;
        }

        if (event.key === "ArrowRight") {
          event.preventDefault();
          showNextViewerImage();
          return;
        }

        return;
      }

      if (isTextInputFocused()) {
        return;
      }

      if (pageType === "swipe") {
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          handleTrash();
          return;
        }

        if (event.key === "ArrowRight") {
          event.preventDefault();
          handleFavorite();
          return;
        }

        if (event.key === "ArrowUp") {
          event.preventDefault();
          handlePlayed();
          return;
        }

        if (event.key === "Enter") {
          if (currentThreadLink) {
            event.preventDefault();
            openLinkInNewTab(currentThreadLink);
          }
          return;
        }

        if (event.key === "Backspace" || event.key.toLowerCase() === "z") {
          if (canUndo) {
            event.preventDefault();
            undoLastAction();
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    canUndo,
    closeDownloadModal,
    closeViewer,
    currentThreadLink,
    downloadModalState.isOpen,
    handleFavorite,
    handlePlayed,
    handleTrash,
    pageType,
    showNextViewerImage,
    showPreviousViewerImage,
    undoLastAction,
    viewerState.isOpen,
  ]);


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

  const averageFavoritesRating = useMemo(() => {
    if (sessionState.favoritesLinks.length === 0) {
      return 0;
    }

    const ratingSum = sessionState.favoritesLinks.reduce((sum, link) => {
      return (
        sum +
        pickRatingForLink(
          link,
          sessionState.processedThreadItemsByLink,
          sessionState.threadItemsByIdentifier,
        )
      );
    }, 0);

    return (
      Math.round((ratingSum / sessionState.favoritesLinks.length) * 100) / 100
    );
  }, [
    sessionState.favoritesLinks,
    sessionState.processedThreadItemsByLink,
    sessionState.threadItemsByIdentifier,
  ]);

  const favoritesUpdatedCount = useMemo(() => {
    return countUpdatedTrackedItems(
      sessionState.favoritesLinks,
      sessionState.processedThreadItemsByLink,
    );
  }, [sessionState.favoritesLinks, sessionState.processedThreadItemsByLink]);

  const playedUpdatedCount = useMemo(() => {
    return countUpdatedTrackedItems(
      playedLinks,
      sessionState.processedThreadItemsByLink,
    );
  }, [playedLinks, sessionState.processedThreadItemsByLink]);

  const cookieRefreshNoticeMessage = useMemo(() => {
    if (!isLikelyCookieRefreshErrorMessage(metadataSyncState.error)) {
      return null;
    }

    return "Не удалось проверить обновления. Похоже, F95 не принял текущие куки. Обнови их во вкладке Куки.";
  }, [metadataSyncState.error]);

  const handleManualMetadataSync = useCallback(() => {
    const pageLimit = Math.max(
      5,
      Math.min(20, Math.max(sessionState.currentPageNumber, 1)),
    );
    void startMetadataSync(pageLimit);
  }, [sessionState.currentPageNumber, startMetadataSync]);

  const handleMoveLinkToList = useCallback(
    (threadLink: string, listType: ListType) => {
      removeDownloadCacheForListType(threadLink, listType);
      moveLinkToList(threadLink, listType);
    },
    [moveLinkToList, removeDownloadCacheForListType],
  );

  const handleClearAllData = useCallback(() => {
    clearHiddenDownloadHosts();
    clearDisabledDownloadHosts();
    clearAllCachedThreadDownloads();
    setPreferredDownloadHosts(resetPreferredDownloadHosts());
    downloadRequestIdRef.current += 1;
    setDownloadModalState(createClosedDownloadModalState());
    setViewerState(createClosedViewerState());
    setHiddenDownloadHosts([]);
    setDisabledDownloadHosts({});
    clearAllData();
  }, [clearAllData]);

  const handleConfirmClearAllData = useCallback(() => {
    const shouldClear = window.confirm(
      "Удалить все локальные данные (сессия + кэш страниц + download cache)?",
    );
    if (shouldClear) {
      handleClearAllData();
    }
  }, [handleClearAllData]);

  const knownDownloadHosts = useMemo(() => {
    return sortDownloadHostsByPreference(
      loadKnownDownloadHosts(),
      preferredDownloadHosts,
    );
  }, [
    preferredDownloadHosts,
    disabledDownloadHosts,
    hiddenDownloadHosts,
    downloadModalState.downloadsData,
  ]);

  const swipeView = (
    <div className="mainGrid">
      <div className="panel">
        <h3 className="panelTitle">Фильтры</h3>

        <div className="swipeSessionBlock">
          <div className="label">Сессия свайпа</div>
          <div className="swipeSessionRow">
            {swipeProgressPills.map((pill) => (
              <span key={pill.label} className="pill">
                {pill.label}: <strong>{pill.value}</strong>
              </span>
            ))}
          </div>
          <div className="swipeSessionActions">
            <button
              className="button"
              type="button"
              onClick={undoLastAction}
              disabled={!canUndo}
            >
              Undo
            </button>
          </div>
        </div>

        <div className="formRow">
          <div className="label">Поиск по title/creator</div>
          <input
            className="input"
            value={sessionState.filterState.searchText}
            onChange={(event) =>
              updateFilterState({ searchText: event.target.value })
            }
            placeholder="например: team18"
          />
        </div>

        <div className="formRow">
          <div className="label">Минимальный рейтинг</div>
          <input
            className="input"
            type="number"
            min={0}
            step={0.1}
            value={sessionState.filterState.minimumRating}
            onChange={(event) =>
              updateFilterState({ minimumRating: Number(event.target.value) })
            }
          />
        </div>

        <label className="checkboxRow">
          <input
            type="checkbox"
            checked={sessionState.filterState.onlyNew}
            onChange={(event) =>
              updateFilterState({ onlyNew: event.target.checked })
            }
          />
          Только new=true
        </label>

        <label className="checkboxRow">
          <input
            type="checkbox"
            checked={sessionState.filterState.hideWatched}
            onChange={(event) =>
              updateFilterState({ hideWatched: event.target.checked })
            }
          />
          Скрыть watched=true
        </label>

        <label className="checkboxRow">
          <input
            type="checkbox"
            checked={sessionState.filterState.hideIgnored}
            onChange={(event) =>
              updateFilterState({ hideIgnored: event.target.checked })
            }
          />
          Скрыть ignored=true
        </label>

        <div
          style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}
        >
          <button className="button" onClick={resetFilterState}>
            Сбросить фильтры
          </button>
        </div>

        <div className="smallText" style={{ marginTop: 12 }}>
          Хоткеи: Left - мусор, Up - играл, Right - закладки, Enter - открыть,
          Backspace/Z - undo
        </div>

        <div className="smallText" style={{ marginTop: 8 }}>
          Просмотр скринов: клик по скрину - fullscreen, Esc - закрыть,
          Left/Right - перелистывание
        </div>
      </div>

      <div className="cardArea">
        {!currentThreadItem ? (
          <div className="statusBox">
            <div style={{ fontWeight: 900, fontSize: 20 }}>
              {isLoadingPage ? "Загрузка..." : "Нет карточек для показа"}
            </div>
            <div className="mutedText">
              Если включены фильтры, возможно, они отфильтровали все. Попробуй
              сбросить фильтры.
            </div>
          </div>
        ) : (
          <div className="card">
            <div className="cardHeader">
              <div className="cardTitle">{currentThreadItem.title}</div>
              <div className="cardSubtitle">
                <div>Creator: {currentThreadItem.creator}</div>
                <div>Version: {currentThreadItem.version}</div>
                <div>Rating: {currentThreadItem.rating ?? 0}</div>
                <div>New: {String(Boolean(currentThreadItem.new))}</div>
              </div>
              <TagChips tags={currentThreadTags} tagsMap={tagsMap} />

              <div className="cardLinkRow">
                <div className="cardLink">{currentThreadLink}</div>
                <button
                  className="button buttonPrimary"
                  type="button"
                  onClick={openCurrentBestDownload}
                  disabled={!currentThreadLink}
                >
                  Скачать лучший
                </button>
                <button
                  className="button"
                  type="button"
                  onClick={openCurrentThreadDownloads}
                  disabled={!currentThreadLink}
                >
                  Загрузки
                </button>
                <button
                  className="button"
                  type="button"
                  onClick={() =>
                    currentThreadLink && openLinkInNewTab(currentThreadLink)
                  }
                  disabled={!currentThreadLink}
                >
                  Открыть (Enter)
                </button>
              </div>
            </div>

            <div className="coverImageBack">
              <img
                className="coverImage"
                src={currentThreadItem.cover}
                alt="cover"
                loading="eager"
                onClick={() =>
                  openViewer(
                    [currentThreadItem.cover, ...currentThreadItem.screens],
                    0,
                  )
                }
              />
            </div>

            <div className="screensSection">
              <div className="screensHeaderRow">
                <div className="screensHeaderTitle">Screens</div>
                <div className="screensHeaderMeta">
                  {currentThreadItem.screens.length} шт. (клик - fullscreen)
                </div>
              </div>

              <div className="screensGrid">
                {currentThreadItem.screens.map((screenUrl, index) => (
                  <img
                    key={screenUrl}
                    className="screenImage"
                    src={screenUrl}
                    alt="screen"
                    loading="lazy"
                    onClick={() => openViewer(currentThreadItem.screens, index)}
                  />
                ))}
              </div>
            </div>

            <div className="cardActions">
              <button
                className="button swipeActionButton swipeActionTrash cardActionTrash"
                onClick={handleTrash}
              >
                <span className="swipeActionIcon" aria-hidden>
                  🗑
                </span>
                <span className="swipeActionLabel">В мусор</span>
                <span className="swipeActionHint">Left</span>
              </button>
              <button
                className="button swipeActionButton swipeActionPlayed cardActionPlayed"
                onClick={handlePlayed}
              >
                <span className="swipeActionIcon" aria-hidden>
                  🎮
                </span>
                <span className="swipeActionLabel">Играл</span>
                <span className="swipeActionHint">↑</span>
              </button>
              <button
                className="button swipeActionButton swipeActionFavorite cardActionFavorite"
                onClick={handleFavorite}
              >
                <span className="swipeActionIcon" aria-hidden>
                  ★
                </span>
                <span className="swipeActionLabel">В закладки</span>
                <span className="swipeActionHint">Right</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const dashboardView = (
    <div className="dashboardScreen">
      <div className="panel">
        <div className="sectionTitleRow">
          <div>
            <h3 className="panelTitle dashboardPanelTitle">Дашборд</h3>
            <div className="smallText">
              Все списки и фильтры собраны в одном месте.
            </div>
          </div>
        </div>
        <div className="dashboardCardsRow">
          <div className="metricCard">
            <div className="metricLabel">Просмотрено</div>
            <div className="metricValue">{sessionState.viewedCount}</div>
          </div>
          <div className="metricCard">
            <div className="metricLabel">Закладки</div>
            <div className="metricValue">
              {sessionState.favoritesLinks.length}
            </div>
            <div className="smallText" style={{ marginTop: 6 }}>
              Средний рейтинг: {averageFavoritesRating}
            </div>
            {favoritesUpdatedCount > 0 ? (
              <div className="smallText" style={{ marginTop: 4 }}>
                Обновились: {favoritesUpdatedCount}
              </div>
            ) : null}
          </div>
          <div className="metricCard">
            <div className="metricLabel">Мусор</div>
            <div className="metricValue">{sessionState.trashLinks.length}</div>
          </div>
          <div className="metricCard">
            <div className="metricLabel">Играл</div>
            <div className="metricValue">{playedCount}</div>
            {playedUpdatedCount > 0 ? (
              <div className="smallText" style={{ marginTop: 6 }}>
                Обновились: {playedUpdatedCount}
              </div>
            ) : null}
          </div>
          <div className="metricCard">
            <div className="metricLabel">В очереди</div>
            <div className="metricValue">
              {sessionState.remainingThreadIdentifiers.length}
            </div>
          </div>
        </div>
      </div>

      <Dashboard
        sessionState={sessionState}
        openBestDownloadForThread={(threadLink, threadTitle) => {
          void openBestDownloadForThread(threadLink, threadTitle);
        }}
        tagsMap={tagsMap}
        openDownloadsForThread={(threadLink, threadTitle) => {
          void openDownloadModal(threadLink, threadTitle);
        }}
        moveLinkToList={handleMoveLinkToList}
        removeLinkFromList={removeLinkFromList}
        pickCoverForLink={pickCoverForLink}
        pickTitleForLink={pickTitleForLink}
        pickCreatorForLink={pickCreatorForLink}
        pickRatingForLink={pickRatingForLink}
      />
    </div>
  );

  const settingsView = (
    <SettingsPage
      preferredDownloadHosts={preferredDownloadHosts}
      disabledDownloadHosts={disabledDownloadHosts}
      hiddenDownloadHosts={hiddenDownloadHosts}
      knownDownloadHosts={knownDownloadHosts}
      tagsCount={Object.keys(tagsMap).length}
      metadataSyncState={metadataSyncState}
      onStartMetadataSync={handleManualMetadataSync}
      onMoveDownloadHost={handleMoveDownloadHost}
      onDisableDownloadHostTemporarily={handleDisableDownloadHostTemporarily}
      onEnableDownloadHost={handleEnableDownloadHost}
      onHideDownloadHost={handleHideDownloadHost}
      onShowDownloadHost={handleShowDownloadHost}
      onResetPreferredDownloadHosts={handleResetPreferredDownloadHosts}
      onClearDisabledDownloadHosts={handleClearDisabledDownloadHosts}
      onClearHiddenDownloadHosts={handleClearHiddenDownloadHosts}
      onImportBundledTagsMap={() => {
        void handleImportBundledTagsMap();
      }}
      onOpenImportTagsMap={() => importTagsMapInputRef.current?.click()}
      onImportTagsMapChange={() => {
        void handleImportTagsMapChange();
      }}
      onExportSessionState={handleExportSessionState}
      onOpenImportSessionState={() => importSessionStateInputRef.current?.click()}
      onImportSessionStateChange={() => {
        void handleImportSessionStateChange();
      }}
      onClearAllData={handleConfirmClearAllData}
      importSessionStateInputRef={importSessionStateInputRef}
      importTagsMapInputRef={importTagsMapInputRef}
      requestedTab={requestedSettingsTab}
    />
  );

  const pageView =
    pageType === "dashboard"
      ? dashboardView
      : pageType === "settings"
        ? settingsView
        : swipeView;

  return (
    <div className="appRoot">
      <div className="topBar">
        <div className="topBarGrid">
          <div />

          <div className="topBarButtons">
            <button
              className={`button ${pageType === "swipe" ? "navButtonActive" : ""}`}
              onClick={() => setPage("swipe")}
            >
              Свайп
            </button>
            <button
              className={`button ${pageType === "dashboard" ? "navButtonActive" : ""}`}
              onClick={() => setPage("dashboard")}
            >
              Дашборд
            </button>
            <button
              className={`button ${pageType === "settings" ? "navButtonActive" : ""}`}
              onClick={() => setPage("settings")}
            >
              Настройки
            </button>

          </div>
        </div>

        {errorMessage ? (
          <div className="smallText" style={{ marginTop: 8 }}>
            {errorMessage}
          </div>
        ) : null}

        {cookieRefreshNoticeMessage ? (
          <div className="topBarNotice">
            <div className="topBarNoticeText">
              {cookieRefreshNoticeMessage}
            </div>
            <button
              className="button topBarNoticeButton"
              type="button"
              onClick={() => setPage("settings", "cookies")}
            >
              Перейти в Куки
            </button>
          </div>
        ) : null}
      </div>

      {pageView}

      <DownloadModal
        isOpen={downloadModalState.isOpen}
        threadLink={downloadModalState.threadLink}
        threadTitle={downloadModalState.threadTitle}
        isLoading={downloadModalState.isLoading}
        errorMessage={downloadModalState.errorMessage}
        downloadsData={downloadModalState.downloadsData}
        preferredDownloadHosts={preferredDownloadHosts}
        disabledDownloadHosts={disabledDownloadHosts}
        hiddenDownloadHosts={hiddenDownloadHosts}
        onClose={closeDownloadModal}
        onOpenBestDownload={(threadLink, threadTitle) => {
          void openBestDownloadForThread(threadLink, threadTitle);
        }}
        onOpenSettings={openSettingsPage}
        onOpenThread={openLinkInNewTab}
      />

      {viewerState.isOpen ? (
        <div
          className="viewerOverlay"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) {
              closeViewer();
            }
          }}
        >
          <div className="viewerContent">
            <div className="viewerTopBar">
              <div className="viewerCounter">
                {viewerState.activeIndex + 1} /{" "}
                {viewerState.imageUrlList.length}
              </div>
              <button
                className="button viewerCloseButton"
                onClick={closeViewer}
              >
                Закрыть (Esc)
              </button>
            </div>

            <div className="viewerImageWrap">
              <button
                className="viewerNavButton viewerNavLeft"
                onClick={showPreviousViewerImage}
                aria-label="Previous"
              >
                ‹
              </button>

              <img
                className="viewerImage"
                src={viewerState.imageUrlList[viewerState.activeIndex]}
                alt="viewer"
                draggable={false}
              />

              <button
                className="viewerNavButton viewerNavRight"
                onClick={showNextViewerImage}
                aria-label="Next"
              >
                ›
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export { App };
