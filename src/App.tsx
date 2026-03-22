import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useF95Browser } from "./f95/useF95Browser";
import {
  buildThreadLink,
  isLikelyCookieRefreshErrorMessage,
} from "./f95/api";
import {
  clearHiddenDownloadHosts,
  clearDisabledDownloadHosts,
  clearAllCachedThreadDownloads,
  collectPreferredDownloadLinks,
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
  saveDisabledDownloadHosts,
  saveHiddenDownloadHosts,
  savePreferredDownloadHosts,
  sortDownloadHostsByPreference,
  showDownloadHost,
} from "./f95/downloads";
import { countUpdatedTrackedItems } from "./f95/updateTracking";
import { downloadJsonFile, readFileAsText, safeJsonParse } from "./f95/utils";
import {
  clearAllStoredData,
  normalizeDefaultSwipeSettings,
  normalizePrefixesMap,
  normalizeSessionState,
  normalizeTagsMap,
  saveDefaultSwipeSettings,
  savePrefixesMap,
  saveSessionState,
  saveTagsMap,
} from "./f95/storage";
import {
  MAX_TAG_FILTERS_PER_GROUP,
  normalizeFilterState,
  normalizeText,
  threadMatchesFilter,
} from "./f95/filtering";
import type {
  DefaultSwipeSettings,
  ListType,
  ProcessedThreadItem,
  SessionState,
  ThreadDownloadsData,
} from "./f95/types";
import { Dashboard } from "./components/Dashboard";
import { DownloadModal } from "./components/DownloadModal";
import { SettingsPage, type SettingsTab } from "./components/SettingsPage";
import { TagChips } from "./components/TagChips";
import {
  clearCookieProxyInput,
  fetchCookieProxyBackup,
  saveCookieProxyInput,
  type CookieProxyBackup,
} from "./f95/cookieProxy";
import {
  getLauncherPrimaryActionLabel,
  isLauncherGameBusy,
} from "./launcher/ui";
import {
  loadBundledPrefixesMapViaLauncher,
  loadBundledTagsMapViaLauncher,
  openExternalUrl,
} from "./launcher/runtime";
import { useLauncherLibrary } from "./launcher/useLauncherLibrary";

const openLinkInNewTab = (link: string) => {
  void openExternalUrl(link);
};

const openLinkViaAnchor = (link: string) => {
  const linkElement = document.createElement("a");
  linkElement.href = link;
  linkElement.target = "_blank";
  linkElement.rel = "noopener noreferrer";
  linkElement.click();
};

const openBackgroundTarget = () => {
  const openedWindow = window.open("", "_blank");
  if (!openedWindow) {
    return null;
  }

  try {
    openedWindow.opener = null;
    openedWindow.blur();
    window.focus();
  } catch {
    // ignore browser-specific focus restrictions
  }

  return openedWindow;
};

const navigateBackgroundTarget = (openedWindow: Window | null, link: string) => {
  if (openedWindow && !openedWindow.closed) {
    try {
      openedWindow.location.replace(link);
      openedWindow.blur();
      window.focus();
      return;
    } catch {
      // ignore and fallback to a regular new tab open
    }
  }

  openLinkViaAnchor(link);
};

const closeBackgroundTarget = (openedWindow: Window | null) => {
  if (!openedWindow || openedWindow.closed) {
    return;
  }

  try {
    openedWindow.close();
  } catch {
    // ignore
  }
};

type BestDownloadOpenOptions = {
  openInBackground?: boolean;
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
    value === "filters" ||
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

const SWIPE_HORIZONTAL_THRESHOLD_PX = 120;
const SWIPE_VERTICAL_THRESHOLD_PX = 110;
const SWIPE_MAX_TILT_DEG = 12;

type SwipeGestureState = {
  isDragging: boolean;
  offsetX: number;
  offsetY: number;
};

type SwipePointerState = {
  pointerId: number | null;
  startX: number;
  startY: number;
};

type SwipeFilterOption = {
  id: number;
  label: string;
  count: number;
};

const createIdleSwipeGestureState = (): SwipeGestureState => ({
  isDragging: false,
  offsetX: 0,
  offsetY: 0,
});

const createIdleSwipePointerState = (): SwipePointerState => ({
  pointerId: null,
  startX: 0,
  startY: 0,
});

const compactNumberFormatter = new Intl.NumberFormat("ru-RU", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const shortDateFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const clamp = (value: number, min: number, max: number) => {
  return Math.min(max, Math.max(min, value));
};

const resolveSwipeActionFromOffset = (
  offsetX: number,
  offsetY: number,
): ListType | null => {
  const absoluteX = Math.abs(offsetX);
  const upwardOffset = -offsetY;

  if (
    upwardOffset >= SWIPE_VERTICAL_THRESHOLD_PX &&
    upwardOffset >= absoluteX * 0.85
  ) {
    return "played";
  }

  if (absoluteX >= SWIPE_HORIZONTAL_THRESHOLD_PX) {
    return offsetX > 0 ? "favorite" : "trash";
  }

  return null;
};

const formatCompactNumber = (value: number | undefined) => {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "0";
  }

  return compactNumberFormatter.format(value);
};

const formatThreadDateLabel = (value: string | undefined) => {
  if (!value) {
    return "Не указана";
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  return shortDateFormatter.format(parsedDate);
};

const SWIPE_SORT_OPTIONS = [
  { value: "date", label: "По дате" },
  { value: "views", label: "По просмотрам" },
] as const;

const serializeDefaultSwipeSettings = (settings: DefaultSwipeSettings) => {
  return JSON.stringify({
    latestGamesSort: settings.latestGamesSort,
    filterState: {
      searchText: settings.filterState.searchText,
      minimumRating: settings.filterState.minimumRating,
      onlyNew: settings.filterState.onlyNew,
      hideWatched: settings.filterState.hideWatched,
      hideIgnored: settings.filterState.hideIgnored,
      includeTagIds: [...settings.filterState.includeTagIds].sort((a, b) => a - b),
      excludeTagIds: [...settings.filterState.excludeTagIds].sort((a, b) => a - b),
      includePrefixIds: [...settings.filterState.includePrefixIds].sort(
        (a, b) => a - b,
      ),
      excludePrefixIds: [...settings.filterState.excludePrefixIds].sort(
        (a, b) => a - b,
      ),
    },
  });
};

type LocalListsBackup = {
  sessionState: SessionState;
  tagsMap: Record<string, string>;
  prefixesMap: Record<string, string>;
};

type LocalSettingsBackup = {
  defaultSwipeSettings: DefaultSwipeSettings;
  tagsMap: Record<string, string>;
  prefixesMap: Record<string, string>;
  preferredDownloadHosts: string[];
  disabledDownloadHosts: Record<string, number>;
  hiddenDownloadHosts: string[];
  cookieProxy: CookieProxyBackup | null;
};

type LocalBackupFile = {
  format: "f95-tinder-local-backup-v1";
  exportType: "all" | "settings" | "lists";
  exportedAtUnixMs: number;
  lists?: LocalListsBackup;
  settings?: LocalSettingsBackup;
};

const LOCAL_BACKUP_FORMAT = "f95-tinder-local-backup-v1";

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
};

const isLocalBackupFile = (value: unknown): value is LocalBackupFile => {
  return (
    isRecord(value) &&
    value.format === LOCAL_BACKUP_FORMAT &&
    (value.exportType === "all" ||
      value.exportType === "settings" ||
      value.exportType === "lists")
  );
};

const normalizeImportedStringList = (value: unknown) => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
};

const normalizeImportedDisabledDownloadHosts = (value: unknown) => {
  if (!isRecord(value)) {
    return {};
  }

  const normalizedMap: Record<string, number> = {};
  for (const [hostLabel, expiresAtUnixMs] of Object.entries(value)) {
    if (
      typeof hostLabel === "string" &&
      typeof expiresAtUnixMs === "number" &&
      Number.isFinite(expiresAtUnixMs)
    ) {
      normalizedMap[hostLabel] = expiresAtUnixMs;
    }
  }

  return normalizedMap;
};

const normalizeCookieProxyBackup = (value: unknown): CookieProxyBackup => {
  if (!isRecord(value)) {
    return {
      source: "none",
      text: null,
      updatedAtUnixMs: null,
    };
  }

  const source =
    value.source === "settings" || value.source === "env" || value.source === "none"
      ? value.source
      : "none";

  return {
    source,
    text: typeof value.text === "string" ? value.text : null,
    updatedAtUnixMs:
      typeof value.updatedAtUnixMs === "number" ? value.updatedAtUnixMs : null,
  };
};

const extractLocalListsBackup = (value: unknown): LocalListsBackup => {
  const rawValue = isLocalBackupFile(value) ? value.lists : value;
  if (!isRecord(rawValue)) {
    throw new Error("Импорт списков: ожидается объект с данными списков");
  }

  const nextSessionState = normalizeSessionState(rawValue.sessionState);
  if (!nextSessionState) {
    throw new Error("Импорт списков: sessionState имеет неверный формат");
  }

  return {
    sessionState: nextSessionState,
    tagsMap: normalizeTagsMap(rawValue.tagsMap),
    prefixesMap: normalizePrefixesMap(rawValue.prefixesMap),
  };
};

const extractLocalSettingsBackup = (value: unknown): LocalSettingsBackup => {
  const rawValue = isLocalBackupFile(value) ? value.settings : value;
  if (!isRecord(rawValue)) {
    throw new Error("Импорт настроек: ожидается объект с данными настроек");
  }
  if (!("defaultSwipeSettings" in rawValue)) {
    throw new Error(
      "Импорт настроек: в файле нет defaultSwipeSettings для восстановления настроек",
    );
  }

  return {
    defaultSwipeSettings: normalizeDefaultSwipeSettings(rawValue.defaultSwipeSettings),
    tagsMap: normalizeTagsMap(rawValue.tagsMap),
    prefixesMap: normalizePrefixesMap(rawValue.prefixesMap),
    preferredDownloadHosts: normalizeImportedStringList(
      rawValue.preferredDownloadHosts,
    ),
    disabledDownloadHosts: normalizeImportedDisabledDownloadHosts(
      rawValue.disabledDownloadHosts,
    ),
    hiddenDownloadHosts: normalizeImportedStringList(rawValue.hiddenDownloadHosts),
    cookieProxy:
      "cookieProxy" in rawValue ? normalizeCookieProxyBackup(rawValue.cookieProxy) : null,
  };
};

const extractLocalAllBackup = (
  value: unknown,
): { lists: LocalListsBackup; settings: LocalSettingsBackup } => {
  if (!isLocalBackupFile(value) || !value.lists || !value.settings) {
    throw new Error(
      "Импорт всего: ожидается backup-файл, в котором есть и lists, и settings",
    );
  }

  return {
    lists: extractLocalListsBackup(value),
    settings: extractLocalSettingsBackup(value),
  };
};

const isInteractiveSwipeTarget = (target: EventTarget | null) => {
  return target instanceof HTMLElement
    ? Boolean(
        target.closest(
          "button, a, input, textarea, select, label, [data-no-swipe='true']",
        ),
      )
    : false;
};

const getSwipeActionCopy = (action: ListType | null) => {
  switch (action) {
    case "favorite":
      return { label: "В закладки", hint: "→ Right", className: "favorite" };
    case "trash":
      return { label: "В мусор", hint: "← Left", className: "trash" };
    case "played":
      return { label: "Играл", hint: "↑ Up", className: "played" };
    default:
      return null;
  }
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
    clearDashboardLists,
    setErrorMessage,
    tagsMap,
    prefixesMap,
    updateTagsMap,
    updatePrefixesMap,
    metadataSyncState,
    startMetadataSync,
    moveLinkToList,
    removeLinkFromList,
  } = useF95Browser();
  const {
    isAvailable: isLauncherAvailable,
    gamesByThreadLink: launcherGamesByThreadLink,
    libraryRootPath,
    downloadGame,
    clearLibrary,
    chooseLaunchTarget,
    deleteGameFiles,
    launchGame,
    openLibraryFolder,
    openMirrorForGame,
    revealGame,
  } = useLauncherLibrary();

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
  const [swipeGestureState, setSwipeGestureState] = useState<SwipeGestureState>(
    () => createIdleSwipeGestureState(),
  );
  const [isSwipeFilterModalOpen, setIsSwipeFilterModalOpen] = useState(false);
  const [swipeTagSearchText, setSwipeTagSearchText] = useState("");
  const [swipePrefixSearchText, setSwipePrefixSearchText] = useState("");
  const [bundledDefaultSwipeSettings, setBundledDefaultSwipeSettings] =
    useState<DefaultSwipeSettings | null>(null);
  const [isBundledDefaultSwipeSettingsChecking, setIsBundledDefaultSwipeSettingsChecking] =
    useState(true);

  const importAllBackupInputRef = useRef<HTMLInputElement | null>(null);
  const importSettingsBackupInputRef = useRef<HTMLInputElement | null>(null);
  const importListsBackupInputRef = useRef<HTMLInputElement | null>(null);
  const importTagsMapInputRef = useRef<HTMLInputElement | null>(null);
  const importPrefixesMapInputRef = useRef<HTMLInputElement | null>(null);
  const downloadRequestIdRef = useRef(0);
  const hasAttemptedBundledTagsBootstrapRef = useRef(false);
  const hasAttemptedBundledPrefixesBootstrapRef = useRef(false);
  const swipeGestureStateRef = useRef<SwipeGestureState>(
    createIdleSwipeGestureState(),
  );
  const swipePointerStateRef = useRef<SwipePointerState>(
    createIdleSwipePointerState(),
  );

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

  const visibleSwipeThreadIdentifiers = useMemo(() => {
    return sessionState.remainingThreadIdentifiers.filter((threadIdentifier) => {
      const threadItem =
        sessionState.threadItemsByIdentifier[String(threadIdentifier)];
      return threadItem
        ? threadMatchesFilter(threadItem, sessionState.filterState)
        : false;
    });
  }, [
    sessionState.filterState,
    sessionState.remainingThreadIdentifiers,
    sessionState.threadItemsByIdentifier,
  ]);

  const visibleSwipeQueueCount = visibleSwipeThreadIdentifiers.length;

  const swipeProgressPills = useMemo(() => {
    return [
      { label: "Страница", value: sessionState.currentPageNumber },
      { label: "В очереди", value: visibleSwipeQueueCount },
      { label: "Просмотрено", value: sessionState.viewedCount },
    ];
  }, [
    sessionState.currentPageNumber,
    sessionState.viewedCount,
    visibleSwipeQueueCount,
  ]);

  const availableSwipeTagOptions = useMemo<SwipeFilterOption[]>(() => {
    const tagCounts = new Map<number, number>();

    for (const threadIdentifier of visibleSwipeThreadIdentifiers) {
      const threadItem =
        sessionState.threadItemsByIdentifier[String(threadIdentifier)];
      if (!threadItem || !Array.isArray(threadItem.tags)) {
        continue;
      }

      const uniqueTagIds = Array.from(
        new Set(threadItem.tags.filter((tagId) => typeof tagId === "number")),
      );

      for (const tagId of uniqueTagIds) {
        tagCounts.set(tagId, (tagCounts.get(tagId) ?? 0) + 1);
      }
    }

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

    return Array.from(tagCounts.entries())
      .map(([tagId, count]) => ({
        id: tagId,
        label: tagsMap[String(tagId)] ?? `#${tagId}`,
        count,
      }))
      .sort((first, second) => first.label.localeCompare(second.label, "ru"));
  }, [
    sessionState.filterState.excludeTagIds,
    sessionState.filterState.includeTagIds,
    sessionState.threadItemsByIdentifier,
    tagsMap,
    visibleSwipeThreadIdentifiers,
  ]);

  const availableSwipePrefixOptions = useMemo<SwipeFilterOption[]>(() => {
    const prefixCounts = new Map<number, number>();

    for (const [prefixIdText] of Object.entries(prefixesMap)) {
      const prefixId = Number(prefixIdText);
      if (Number.isInteger(prefixId)) {
        prefixCounts.set(prefixId, 0);
      }
    }

    for (const threadIdentifier of visibleSwipeThreadIdentifiers) {
      const threadItem =
        sessionState.threadItemsByIdentifier[String(threadIdentifier)];
      if (!threadItem || !Array.isArray(threadItem.prefixes)) {
        continue;
      }

      const uniquePrefixIds = Array.from(
        new Set(
          threadItem.prefixes.filter(
            (prefixId) =>
              typeof prefixId === "number" &&
              typeof prefixesMap[String(prefixId)] === "string",
          ),
        ),
      );

      for (const prefixId of uniquePrefixIds) {
        prefixCounts.set(prefixId, (prefixCounts.get(prefixId) ?? 0) + 1);
      }
    }

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

    return Array.from(prefixCounts.entries())
      .map(([prefixId, count]) => ({
        id: prefixId,
        label: prefixesMap[String(prefixId)] ?? `#${prefixId}`,
        count,
      }))
      .sort((first, second) => first.label.localeCompare(second.label, "ru"));
  }, [
    prefixesMap,
    sessionState.filterState.excludePrefixIds,
    sessionState.filterState.includePrefixIds,
    sessionState.threadItemsByIdentifier,
    visibleSwipeThreadIdentifiers,
  ]);

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

  const performSwipeAction = useCallback(
    (action: ListType) => {
      if (action === "favorite") {
        handleFavorite();
        return;
      }

      if (action === "trash") {
        handleTrash();
        return;
      }

      handlePlayed();
    },
    [handleFavorite, handlePlayed, handleTrash],
  );

  const createListsBackup = useCallback(
    (): LocalListsBackup => ({
      sessionState,
      tagsMap,
      prefixesMap,
    }),
    [prefixesMap, sessionState, tagsMap],
  );

  const createSettingsBackup = useCallback(async (): Promise<LocalSettingsBackup> => {
    return {
      defaultSwipeSettings: normalizeDefaultSwipeSettings({
        latestGamesSort: defaultLatestGamesSort,
        filterState: defaultFilterState,
      }),
      tagsMap,
      prefixesMap,
      preferredDownloadHosts,
      disabledDownloadHosts,
      hiddenDownloadHosts,
      cookieProxy: await fetchCookieProxyBackup(),
    };
  }, [
    defaultFilterState,
    defaultLatestGamesSort,
    disabledDownloadHosts,
    hiddenDownloadHosts,
    prefixesMap,
    preferredDownloadHosts,
    tagsMap,
  ]);

  const applyImportedListsBackup = useCallback((backup: LocalListsBackup) => {
    saveSessionState(backup.sessionState);
    saveTagsMap(backup.tagsMap);
    savePrefixesMap(backup.prefixesMap);
  }, []);

  const applyImportedSettingsBackup = useCallback(
    async (backup: LocalSettingsBackup) => {
      if (backup.cookieProxy) {
        if (backup.cookieProxy.source === "settings" && backup.cookieProxy.text) {
          await saveCookieProxyInput(backup.cookieProxy.text);
        } else if (backup.cookieProxy.source === "settings") {
          throw new Error(
            "Импорт настроек: cookieProxy.source=settings, но текст кук отсутствует",
          );
        } else {
          await clearCookieProxyInput();
        }
      }

      saveDefaultSwipeSettings(backup.defaultSwipeSettings);
      saveTagsMap(backup.tagsMap);
      savePrefixesMap(backup.prefixesMap);
      savePreferredDownloadHosts(backup.preferredDownloadHosts);
      saveDisabledDownloadHosts(backup.disabledDownloadHosts);
      saveHiddenDownloadHosts(backup.hiddenDownloadHosts);
    },
    [],
  );

  const handleExportAllBackup = useCallback(async () => {
    try {
      setErrorMessage(null);
      const payload: LocalBackupFile = {
        format: LOCAL_BACKUP_FORMAT,
        exportType: "all",
        exportedAtUnixMs: Date.now(),
        lists: createListsBackup(),
        settings: await createSettingsBackup(),
      };
      downloadJsonFile("f95-tinder-all.json", payload);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Ошибка экспорта локальных данных",
      );
    }
  }, [createListsBackup, createSettingsBackup, setErrorMessage]);

  const handleExportSettingsBackup = useCallback(async () => {
    try {
      setErrorMessage(null);
      const payload: LocalBackupFile = {
        format: LOCAL_BACKUP_FORMAT,
        exportType: "settings",
        exportedAtUnixMs: Date.now(),
        settings: await createSettingsBackup(),
      };
      downloadJsonFile("f95-tinder-settings.json", payload);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Ошибка экспорта настроек",
      );
    }
  }, [createSettingsBackup, setErrorMessage]);

  const handleExportListsBackup = useCallback(() => {
    setErrorMessage(null);
    const payload: LocalBackupFile = {
      format: LOCAL_BACKUP_FORMAT,
      exportType: "lists",
      exportedAtUnixMs: Date.now(),
      lists: createListsBackup(),
    };
    downloadJsonFile("f95-tinder-lists.json", payload);
  }, [createListsBackup, setErrorMessage]);

  const handleImportAllBackupChange = useCallback(async () => {
    const inputElement = importAllBackupInputRef.current;
    const file = inputElement?.files?.[0];
    if (!file) {
      return;
    }

    try {
      setErrorMessage(null);
      const fileText = await readFileAsText(file);
      const parsedJson = safeJsonParse<unknown>(fileText);
      const backup = extractLocalAllBackup(parsedJson);

      await applyImportedSettingsBackup(backup.settings);
      applyImportedListsBackup(backup.lists);
      window.location.reload();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Ошибка импорта локальных данных",
      );
    } finally {
      if (inputElement) {
        inputElement.value = "";
      }
    }
  }, [applyImportedListsBackup, applyImportedSettingsBackup, setErrorMessage]);

  const handleImportSettingsBackupChange = useCallback(async () => {
    const inputElement = importSettingsBackupInputRef.current;
    const file = inputElement?.files?.[0];
    if (!file) {
      return;
    }

    try {
      setErrorMessage(null);
      const fileText = await readFileAsText(file);
      const parsedJson = safeJsonParse<unknown>(fileText);
      const backup = extractLocalSettingsBackup(parsedJson);

      await applyImportedSettingsBackup(backup);
      window.location.reload();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Ошибка импорта настроек",
      );
    } finally {
      if (inputElement) {
        inputElement.value = "";
      }
    }
  }, [applyImportedSettingsBackup, setErrorMessage]);

  const handleImportListsBackupChange = useCallback(async () => {
    const inputElement = importListsBackupInputRef.current;
    const file = inputElement?.files?.[0];
    if (!file) {
      return;
    }

    try {
      setErrorMessage(null);
      const fileText = await readFileAsText(file);
      const parsedJson = safeJsonParse<unknown>(fileText);
      const backup = extractLocalListsBackup(parsedJson);

      applyImportedListsBackup(backup);
      window.location.reload();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Ошибка импорта списков",
      );
    } finally {
      if (inputElement) {
        inputElement.value = "";
      }
    }
  }, [applyImportedListsBackup, setErrorMessage]);

  const handleImportTagsMapChange = useCallback(async () => {
    const inputElement = importTagsMapInputRef.current;
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
        throw new Error("Импорт: ожидается объект тегов");
      }

      updateTagsMap(normalizeTagsMap(parsedJson));
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Ошибка импорта тегов",
      );
    } finally {
      if (inputElement) {
        inputElement.value = "";
      }
    }
  }, [normalizeTagsMap, setErrorMessage, updateTagsMap]);

  const handleImportPrefixesMapChange = useCallback(async () => {
    const inputElement = importPrefixesMapInputRef.current;
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
        throw new Error("Импорт: ожидается объект префиксов");
      }

      updatePrefixesMap(normalizePrefixesMap(parsedJson));
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Ошибка импорта префиксов",
      );
    } finally {
      if (inputElement) {
        inputElement.value = "";
      }
    }
  }, [normalizePrefixesMap, setErrorMessage, updatePrefixesMap]);

  const loadBundledTagsMap = useCallback(async () => {
    const launcherTagsMap = await loadBundledTagsMapViaLauncher();
    const parsedJson = launcherTagsMap
      ? (launcherTagsMap as unknown)
      : ((await (async () => {
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

          return response.json();
        })()) as unknown);
    const normalizedTagsMap = normalizeTagsMap(parsedJson);

    if (Object.keys(normalizedTagsMap).length === 0) {
      throw new Error("Встроенный tags.json пустой или имеет неверный формат");
    }

    return normalizedTagsMap;
  }, [normalizeTagsMap]);

  const loadBundledPrefixesMap = useCallback(async () => {
    const launcherPrefixesMap = await loadBundledPrefixesMapViaLauncher();
    const parsedJson = launcherPrefixesMap
      ? (launcherPrefixesMap as unknown)
      : ((await (async () => {
          const response = await fetch("/prefixes.json", {
            method: "GET",
            headers: {
              Accept: "application/json",
            },
          });

          if (!response.ok) {
            throw new Error(
              `Не удалось загрузить встроенные префиксы: ${response.status}`,
            );
          }

          return response.json();
        })()) as unknown);
    const normalizedPrefixesMap = normalizePrefixesMap(parsedJson);

    if (Object.keys(normalizedPrefixesMap).length === 0) {
      throw new Error(
        "Встроенный prefixes.json пустой или имеет неверный формат",
      );
    }

    return normalizedPrefixesMap;
  }, [normalizePrefixesMap]);

  const loadBundledDefaultSwipeSettings = useCallback(async () => {
    const response = await fetch("/default-filters.json", {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(
        `Не удалось загрузить встроенные дефолтные фильтры: ${response.status}`,
      );
    }

    const parsedJson = (await response.json()) as unknown;

    if (!parsedJson || typeof parsedJson !== "object" || Array.isArray(parsedJson)) {
      throw new Error(
        "Встроенный default-filters.json пустой или имеет неверный формат",
      );
    }

    return normalizeDefaultSwipeSettings(parsedJson);
  }, [normalizeDefaultSwipeSettings]);

  const handleImportBundledTagsMap = useCallback(async () => {
    try {
      setErrorMessage(null);
      updateTagsMap(await loadBundledTagsMap());
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Ошибка загрузки встроенных тегов",
      );
    }
  }, [loadBundledTagsMap, setErrorMessage, updateTagsMap]);

  const handleImportBundledPrefixesMap = useCallback(async () => {
    try {
      setErrorMessage(null);
      updatePrefixesMap(await loadBundledPrefixesMap());
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Ошибка загрузки встроенных префиксов",
      );
    }
  }, [loadBundledPrefixesMap, setErrorMessage, updatePrefixesMap]);

  const handleImportBundledDefaultFilterState = useCallback(async () => {
    try {
      setErrorMessage(null);
      replaceDefaultSwipeSettings(await loadBundledDefaultSwipeSettings());
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Ошибка загрузки встроенных дефолтных фильтров",
      );
    }
  }, [
    loadBundledDefaultSwipeSettings,
    replaceDefaultSwipeSettings,
    setErrorMessage,
  ]);

  useEffect(() => {
    let isCancelled = false;

    setIsBundledDefaultSwipeSettingsChecking(true);

    void (async () => {
      try {
        const nextBundledDefaultSwipeSettings =
          await loadBundledDefaultSwipeSettings();
        if (!isCancelled) {
          setBundledDefaultSwipeSettings(nextBundledDefaultSwipeSettings);
        }
      } catch {
        if (!isCancelled) {
          setBundledDefaultSwipeSettings(null);
        }
      } finally {
        if (!isCancelled) {
          setIsBundledDefaultSwipeSettingsChecking(false);
        }
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [loadBundledDefaultSwipeSettings]);

  useEffect(() => {
    if (Object.keys(tagsMap).length > 0) {
      hasAttemptedBundledTagsBootstrapRef.current = false;
      return;
    }

    if (hasAttemptedBundledTagsBootstrapRef.current) {
      return;
    }

    hasAttemptedBundledTagsBootstrapRef.current = true;

    void (async () => {
      try {
        updateTagsMap(await loadBundledTagsMap());
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Ошибка загрузки встроенных тегов";
        setErrorMessage((previousState) => previousState ?? message);
      }
    })();
  }, [loadBundledTagsMap, setErrorMessage, tagsMap, updateTagsMap]);

  useEffect(() => {
    if (Object.keys(prefixesMap).length > 0) {
      hasAttemptedBundledPrefixesBootstrapRef.current = false;
      return;
    }

    if (hasAttemptedBundledPrefixesBootstrapRef.current) {
      return;
    }

    hasAttemptedBundledPrefixesBootstrapRef.current = true;

    void (async () => {
      try {
        updatePrefixesMap(await loadBundledPrefixesMap());
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Ошибка загрузки встроенных префиксов";
        setErrorMessage((previousState) => previousState ?? message);
      }
    })();
  }, [
    loadBundledPrefixesMap,
    prefixesMap,
    setErrorMessage,
    updatePrefixesMap,
  ]);

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

  const openBestDownloadForThread = useCallback(
    async (
      threadLink: string,
      threadTitle: string,
      options: BestDownloadOpenOptions = {},
    ) => {
      const launcherGame = launcherGamesByThreadLink[threadLink] ?? null;
      if (isLauncherAvailable) {
        if (launcherGame?.status === "installed") {
          try {
            await launchGame(threadLink);
          } catch (error) {
            setErrorMessage(
              error instanceof Error ? error.message : "Не удалось запустить игру",
            );
          }
          return;
        }

        if (isLauncherGameBusy(launcherGame)) {
          return;
        }

        try {
          const downloadsData = await loadOrFetchThreadDownloads(threadLink);
          const preferredDownloadLinkList = collectPreferredDownloadLinks(
            downloadsData,
            preferredDownloadHosts,
            disabledDownloadHosts,
            hiddenDownloadHosts,
          );
          const bestDownloadLink = preferredDownloadLinkList[0] ?? null;

          if (bestDownloadLink?.url) {
            await downloadGame({
              threadLink,
              threadTitle,
              downloadUrl: bestDownloadLink.url,
              hostLabel: bestDownloadLink.label,
              downloadSources: preferredDownloadLinkList
                .filter((link) => typeof link.url === "string")
                .map((link) => ({
                  downloadUrl: link.url as string,
                  hostLabel: link.label,
                })),
            });
            return;
          }

          showDownloadModal(threadLink, threadTitle, downloadsData, false, null);
          return;
        } catch (error) {
          showDownloadModal(
            threadLink,
            threadTitle,
            null,
            false,
            error instanceof Error
              ? error.message
              : "Не удалось подготовить загрузку",
          );
          return;
        }
      }

      const pendingBackgroundTarget = options.openInBackground
        ? openBackgroundTarget()
        : null;

      try {
        const downloadsData = await loadOrFetchThreadDownloads(threadLink);
        const preferredDownloadLinkList = collectPreferredDownloadLinks(
          downloadsData,
          preferredDownloadHosts,
          disabledDownloadHosts,
          hiddenDownloadHosts,
        );
        const bestDownloadLink =
          preferredDownloadLinkList[0] ??
          findBestDownloadLink(
            downloadsData,
            preferredDownloadHosts,
            disabledDownloadHosts,
            hiddenDownloadHosts,
          );

        if (bestDownloadLink?.url) {
          if (options.openInBackground) {
            navigateBackgroundTarget(pendingBackgroundTarget, bestDownloadLink.url);
          } else {
            openLinkInNewTab(bestDownloadLink.url);
          }
          return;
        }

        closeBackgroundTarget(pendingBackgroundTarget);
        showDownloadModal(threadLink, threadTitle, downloadsData, false, null);
      } catch (error) {
        closeBackgroundTarget(pendingBackgroundTarget);
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
      downloadGame,
      hiddenDownloadHosts,
      isLauncherAvailable,
      launchGame,
      launcherGamesByThreadLink,
      preferredDownloadHosts,
      setErrorMessage,
      showDownloadModal,
    ],
  );

  const handleOpenErrorMirrorForThread = useCallback(
    (threadLink: string, threadTitle: string) => {
      const launcherGame = launcherGamesByThreadLink[threadLink] ?? null;

      if (
        isLauncherAvailable &&
        launcherGame?.lastDownloadUrl &&
        !isLauncherGameBusy(launcherGame)
      ) {
        void openMirrorForGame(threadLink).catch((error) => {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Не удалось открыть зеркало для ручной загрузки",
          );
        });
        return;
      }

      void openBestDownloadForThread(threadLink, threadTitle);
    },
    [
      isLauncherAvailable,
      launcherGamesByThreadLink,
      openBestDownloadForThread,
      openMirrorForGame,
      setErrorMessage,
    ],
  );

  const handleDeleteGameFilesForThread = useCallback(
    (threadLink: string, threadTitle: string) => {
      const shouldDelete = window.confirm(
        `Удалить локальные файлы игры "${threadTitle}"? Это удалит архив и распакованную папку, но не тронет списки в дашборде.`,
      );
      if (!shouldDelete) {
        return Promise.resolve();
      }

      return deleteGameFiles(threadLink).catch((error) => {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Не удалось удалить файлы игры",
        );
        throw error;
      }).then(() => undefined);
    },
    [deleteGameFiles, setErrorMessage],
  );

  const handleChooseLaunchTargetForThread = useCallback(
    (threadLink: string) => {
      return chooseLaunchTarget(threadLink)
        .catch((error) => {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Не удалось выбрать запускатор игры",
          );
          throw error;
        })
        .then(() => undefined);
    },
    [chooseLaunchTarget, setErrorMessage],
  );

  const handleSwipePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (
        !currentThreadItem ||
        downloadModalState.isOpen ||
        viewerState.isOpen ||
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
      downloadModalState.isOpen,
      isSwipeFilterModalOpen,
      updateSwipeGestureState,
      viewerState.isOpen,
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
      if (isSwipeFilterModalOpen) {
        if (event.key === "Escape") {
          event.preventDefault();
          setIsSwipeFilterModalOpen(false);
        }
        return;
      }

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
    isSwipeFilterModalOpen,
    pageType,
    showNextViewerImage,
    showPreviousViewerImage,
    setIsSwipeFilterModalOpen,
    undoLastAction,
    viewerState.isOpen,
  ]);

  useEffect(() => {
    resetSwipeGesture();
  }, [currentThreadIdentifier, pageType, resetSwipeGesture]);


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

  const currentThreadPrimaryMeta = useMemo(() => {
    if (!currentThreadItem) {
      return [];
    }

    return [
      currentThreadItem.creator,
      `v${currentThreadItem.version || "?"}`,
      currentThreadPrefixLabels.length > 0
        ? currentThreadPrefixLabels.join(", ")
        : null,
    ].filter((value): value is string => Boolean(value));
  }, [currentThreadItem, currentThreadPrefixLabels]);

  const currentThreadPreviewScreens = useMemo(() => {
    if (!currentThreadItem) {
      return [];
    }

    return currentThreadItem.screens;
  }, [currentThreadItem]);

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

  const dashboardTotalCount =
    sessionState.favoritesLinks.length +
    sessionState.trashLinks.length +
    playedCount;

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

  const currentDefaultSwipeSettings = useMemo(
    () =>
      normalizeDefaultSwipeSettings({
        latestGamesSort: defaultLatestGamesSort,
        filterState: defaultFilterState,
      }),
    [defaultFilterState, defaultLatestGamesSort],
  );

  const bundledDefaultFiltersStatus = useMemo(() => {
    if (isBundledDefaultSwipeSettingsChecking) {
      return "checking" as const;
    }

    if (!bundledDefaultSwipeSettings) {
      return "unavailable" as const;
    }

    return serializeDefaultSwipeSettings(currentDefaultSwipeSettings) ===
      serializeDefaultSwipeSettings(bundledDefaultSwipeSettings)
      ? ("loaded" as const)
      : ("not_loaded" as const);
  }, [
    bundledDefaultSwipeSettings,
    currentDefaultSwipeSettings,
    isBundledDefaultSwipeSettingsChecking,
  ]);

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

  const handleClearGameFolders = useCallback(() => {
    if (!isLauncherAvailable) {
      setErrorMessage("Очистка папок с играми доступна только в Electron-версии.");
      return;
    }

    void clearLibrary().catch((error) => {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Не удалось очистить папки с играми",
      );
    });
  }, [clearLibrary, isLauncherAvailable, setErrorMessage]);

  const handleOpenGameFolders = useCallback(() => {
    if (!isLauncherAvailable) {
      setErrorMessage("Открытие папки с играми доступно только в Electron-версии.");
      return;
    }

    void openLibraryFolder().catch((error) => {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Не удалось открыть папку с играми",
      );
    });
  }, [isLauncherAvailable, openLibraryFolder, setErrorMessage]);

  const handleConfirmClearDashboardLists = useCallback(() => {
    const shouldClear = window.confirm(
      "Очистить списки в дашборде? Это удалит Закладки, Мусор и Играл, но не тронет папки с играми.",
    );
    if (shouldClear) {
      clearDashboardLists();
    }
  }, [clearDashboardLists]);

  const handleConfirmResetLocalSettings = useCallback(() => {
    const shouldReset = window.confirm(
      "Сбросить локальные настройки? Это вернет дефолтные фильтры, очистит tags/prefixes map, сбросит настройки хостов и локально сохраненные куки proxy.",
    );
    if (!shouldReset) {
      return;
    }

    void (async () => {
      try {
        setErrorMessage(null);
        saveDefaultSwipeSettings(undefined);
        saveTagsMap({});
        savePrefixesMap({});
        resetPreferredDownloadHosts();
        clearDisabledDownloadHosts();
        clearHiddenDownloadHosts();
        await clearCookieProxyInput();
        window.location.reload();
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "Не удалось сбросить настройки",
        );
      }
    })();
  }, [setErrorMessage]);

  const handleConfirmClearAllLocalData = useCallback(() => {
    const shouldClear = window.confirm(
      "Очистить все локальные данные? Это удалит списки, фильтры, карты tags/prefixes, настройки хостов, локальные куки proxy и кэш. Папка игр launcher'а не будет затронута.",
    );
    if (!shouldClear) {
      return;
    }

    void (async () => {
      try {
        setErrorMessage(null);
        clearAllStoredData();
        clearAllCachedThreadDownloads();
        resetPreferredDownloadHosts();
        clearDisabledDownloadHosts();
        clearHiddenDownloadHosts();
        await clearCookieProxyInput();
        window.location.reload();
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Не удалось очистить локальные данные",
        );
      }
    })();
  }, [setErrorMessage]);

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

  const openCurrentThreadPage = useCallback(() => {
    if (currentThreadLink) {
      openLinkInNewTab(currentThreadLink);
    }
  }, [currentThreadLink]);

  const renderSwipeFilterOptionGroup = (
    title: string,
    fieldName: string,
    options: SwipeFilterOption[],
    selectedIds: number[],
    onToggle: (id: number) => void,
    variant: "include" | "exclude",
    countMeta?: string,
  ) => {
    return (
      <div className="swipeFilterModalGroup">
        <div className="swipeFilterModalGroupHeader">
          <div>
            <div className="swipeFilterModalGroupTitle">{title}</div>
            <div className="swipeFilterModalGroupField">{fieldName}</div>
          </div>
          <div className="swipeFilterModalGroupMeta">
            {countMeta ?? `Выбрано: ${selectedIds.length}`}
          </div>
        </div>

        <div className="tagFilterChips swipeFilterModalChipGrid">
          {options.length > 0 ? (
            options.map((option) => {
              const isActive = selectedIds.includes(option.id);
              const activeClassName = isActive
                ? variant === "exclude"
                  ? "tagFilterChipExcludeActive"
                  : "tagFilterChipActive"
                : "";

              return (
                <button
                  key={`${title}-${option.id}`}
                  type="button"
                  className={`tagFilterChip ${activeClassName}`}
                  onClick={() => onToggle(option.id)}
                >
                  {option.label}
                </button>
              );
            })
          ) : (
            <span className="smallText">Ничего не найдено</span>
          )}
        </div>
      </div>
    );
  };

  const swipeMetaContent = currentThreadItem ? (
    <div className="swipeMetaBody">
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
          <TagChips
            tags={currentThreadTags}
            tagsMap={tagsMap}
            maxVisible={12}
          />
        </div>
      ) : null}

      {currentThreadLink ? (
        <div className="swipeMetaLink">{currentThreadLink}</div>
      ) : null}
    </div>
  ) : null;

  const swipeView = (
    <div className="swipeScreen">
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
          </div>

          <div className="panel swipeSidebarSectionPanel swipeFilterSection">
            <div className="sectionTitleRow">
              <div className="sectionTitle">Поиск и фильтры</div>
              <button className="button" type="button" onClick={resetFilterState}>
                Сбросить
              </button>
            </div>

            <div className="formRow" style={{ marginBottom: 0 }}>
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

            <div className="formRow" style={{ marginBottom: 0 }}>
              <div className="label">Сортировка</div>
              <select
                className="input"
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

            <div className="sectionTitleRow">
              <div className="sectionTitle">Фильтры</div>
              <div className="sectionMeta">Выбрано: {selectedSwipeFilterCount}</div>
            </div>

            <div className="swipeFilterTriggerRow">
              <button
                className="button buttonPrimary"
                type="button"
                onClick={() => setIsSwipeFilterModalOpen(true)}
              >
                Открыть фильтры
              </button>

              {hasActiveSwipeFilterSelections ? (
                <button
                  className="button"
                  type="button"
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
          </div>
        </div>
      </div>

      <div className="swipeCenterColumn">
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
                  <div className="swipeFocusCardSubtitle">
                    {currentThreadPrimaryMeta.map((item) => (
                      <span key={item}>{item}</span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="swipeFocusCardBody">
                <div className="swipeHeroPanel" data-no-swipe="true">
                  <div className="swipeMediaSectionLabel">Лого</div>
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
                            openViewer(
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
                      onClick={openCurrentThreadPage}
                      disabled={!currentThreadLink}
                    >
                      Открыть страницу
                    </button>

                    {swipeMetaContent}
                  </div>
                </div>

                <div className="swipeScreensPanel" data-no-swipe="true">
                  <div className="swipeScreensPanelHeader">
                    <div className="swipeMediaSectionLabel">Скриншоты</div>
                    <div className="swipeScreensPanelMeta">
                      {currentThreadPreviewScreens.length}
                    </div>
                  </div>

                  {currentThreadPreviewScreens.length > 0 ? (
                    <div className="swipeCompactScreens">
                      {currentThreadPreviewScreens.map((screenUrl, index) => (
                        <button
                          key={screenUrl}
                          type="button"
                          className="swipeScreenTile"
                          onClick={() => openViewer(currentThreadItem.screens, index)}
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
        )}
      </div>

      <div className="panel swipeActionSidebar">
        <button
          className={`button swipeSideActionButton swipeActionTrash ${
            swipeHudAction?.className === "trash"
              ? "swipeSideActionButtonActive"
              : ""
          }`}
          type="button"
          onClick={handleTrash}
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
          onClick={handlePlayed}
          disabled={!currentThreadItem}
        >
          <span className="swipeActionIcon" aria-hidden>
            🎮
          </span>
          <span className="swipeActionLabel">Играл</span>
          <span className="swipeActionHint">Up</span>
        </button>
        <button
          className={`button swipeSideActionButton swipeActionFavorite ${
            swipeHudAction?.className === "favorite"
              ? "swipeSideActionButtonActive"
              : ""
          }`}
          type="button"
          onClick={handleFavorite}
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
            <div className="metricLabel">Всего</div>
            <div className="metricValue">{dashboardTotalCount}</div>
          </div>
          <div className="metricCard">
            <div className="metricLabel">Закладки</div>
            <div className="metricValue">
              {sessionState.favoritesLinks.length}
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
        </div>
      </div>

      <Dashboard
        sessionState={sessionState}
        isLauncherAvailable={isLauncherAvailable}
        launcherGamesByThreadLink={launcherGamesByThreadLink}
        openBestDownloadForThread={openBestDownloadForThread}
        onOpenThread={openLinkInNewTab}
        onOpenImageViewer={openViewer}
        tagsMap={tagsMap}
        prefixesMap={prefixesMap}
        onRevealInstalledGame={(threadLink) => {
          void revealGame(threadLink).catch((error) => {
            setErrorMessage(
              error instanceof Error
                ? error.message
                : "Не удалось открыть папку игры",
            );
          });
        }}
        onDeleteGameFilesForThread={handleDeleteGameFilesForThread}
        onChooseLaunchTargetForThread={handleChooseLaunchTargetForThread}
        onOpenErrorMirrorForThread={handleOpenErrorMirrorForThread}
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
      prefixesCount={Object.keys(prefixesMap).length}
      metadataSyncState={metadataSyncState}
      bundledDefaultFiltersStatus={bundledDefaultFiltersStatus}
      currentFilterState={sessionState.filterState}
      defaultFilterState={defaultFilterState}
      defaultLatestGamesSort={defaultLatestGamesSort}
      tagsMap={tagsMap}
      prefixesMap={prefixesMap}
      onStartMetadataSync={handleManualMetadataSync}
      onUpdateDefaultFilterState={updateDefaultFilterState}
      onUpdateDefaultLatestGamesSort={updateDefaultLatestGamesSort}
      onResetDefaultFilterState={resetDefaultFilterState}
      onImportBundledDefaultFilterState={() => {
        void handleImportBundledDefaultFilterState();
      }}
      onSaveCurrentFiltersAsDefault={saveCurrentFilterStateAsDefault}
      onApplyDefaultFiltersToSwipe={applyDefaultFilterStateToSwipe}
      onMoveDownloadHost={handleMoveDownloadHost}
      onDisableDownloadHostTemporarily={handleDisableDownloadHostTemporarily}
      onEnableDownloadHost={handleEnableDownloadHost}
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
      onImportBundledPrefixesMap={() => {
        void handleImportBundledPrefixesMap();
      }}
      onOpenImportPrefixesMap={() => importPrefixesMapInputRef.current?.click()}
      onImportPrefixesMapChange={() => {
        void handleImportPrefixesMapChange();
      }}
      onExportAllBackup={() => {
        void handleExportAllBackup();
      }}
      onExportSettingsBackup={() => {
        void handleExportSettingsBackup();
      }}
      onExportListsBackup={handleExportListsBackup}
      onOpenImportAllBackup={() => importAllBackupInputRef.current?.click()}
      onImportAllBackupChange={() => {
        void handleImportAllBackupChange();
      }}
      onOpenImportSettingsBackup={() =>
        importSettingsBackupInputRef.current?.click()
      }
      onImportSettingsBackupChange={() => {
        void handleImportSettingsBackupChange();
      }}
      onOpenImportListsBackup={() => importListsBackupInputRef.current?.click()}
      onImportListsBackupChange={() => {
        void handleImportListsBackupChange();
      }}
      onOpenGameFolders={handleOpenGameFolders}
      onClearGameFolders={handleClearGameFolders}
      onClearAllLocalData={handleConfirmClearAllLocalData}
      onResetLocalSettings={handleConfirmResetLocalSettings}
      onClearDashboardLists={handleConfirmClearDashboardLists}
      isLauncherAvailable={isLauncherAvailable}
      libraryRootPath={libraryRootPath}
      importAllBackupInputRef={importAllBackupInputRef}
      importSettingsBackupInputRef={importSettingsBackupInputRef}
      importListsBackupInputRef={importListsBackupInputRef}
      importTagsMapInputRef={importTagsMapInputRef}
      importPrefixesMapInputRef={importPrefixesMapInputRef}
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

      {isSwipeFilterModalOpen ? (
        <div
          className="swipeFilterModalOverlay"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) {
              setIsSwipeFilterModalOpen(false);
            }
          }}
        >
          <div className="swipeFilterModal">
            <div className="swipeFilterModalTopBar">
              <div className="swipeFilterModalIntro">
                <div className="swipeFilterModalTitle">Фильтры свайпа</div>
                <div className="swipeFilterModalMeta">
                  `prefixes[]` и `noprefixes[]` без лимита. `tags[]` и `notags[]`
                  до {MAX_TAG_FILTERS_PER_GROUP}.
                </div>
              </div>

              <div className="swipeFilterModalActions">
                <button
                  className="button"
                  type="button"
                  onClick={clearSwipeTagFilters}
                >
                  Очистить
                </button>
                <button
                  className="button"
                  type="button"
                  onClick={() => setIsSwipeFilterModalOpen(false)}
                >
                  Закрыть
                </button>
              </div>
            </div>

            <div className="swipeFilterModalBody">
              <div className="swipeFilterModalSection">
                <div className="swipeFilterModalSectionHeader">
                  <div className="swipeFilterModalSectionTitle">Префиксы</div>
                  <div className="swipeFilterModalSectionMeta">
                    Выбрано: {selectedSwipePrefixCount}
                  </div>
                </div>

                <div className="formRow" style={{ marginBottom: 0 }}>
                  <div className="label">Поиск по префиксам</div>
                  <input
                    className="input"
                    value={swipePrefixSearchText}
                    onChange={(event) =>
                      setSwipePrefixSearchText(event.target.value)
                    }
                    placeholder="например: ren'py, unity"
                  />
                </div>

                <div className="swipeFilterModalGroupGrid">
                  {renderSwipeFilterOptionGroup(
                    "Включить",
                    "prefixes[]",
                    filteredSwipePrefixOptions,
                    sessionState.filterState.includePrefixIds,
                    toggleSwipeIncludePrefix,
                    "include",
                  )}
                  {renderSwipeFilterOptionGroup(
                    "Выключить",
                    "noprefixes[]",
                    filteredSwipePrefixOptions,
                    sessionState.filterState.excludePrefixIds,
                    toggleSwipeExcludePrefix,
                    "exclude",
                  )}
                </div>
              </div>

              <div className="swipeFilterModalSection">
                <div className="swipeFilterModalSectionHeader">
                  <div className="swipeFilterModalSectionTitle">Теги</div>
                  <div className="swipeFilterModalSectionMeta">
                    Включить: {sessionState.filterState.includeTagIds.length}/
                    {MAX_TAG_FILTERS_PER_GROUP} • Выключить:{" "}
                    {sessionState.filterState.excludeTagIds.length}/
                    {MAX_TAG_FILTERS_PER_GROUP}
                  </div>
                </div>

                <div className="formRow" style={{ marginBottom: 0 }}>
                  <div className="label">Поиск по тегам</div>
                  <input
                    className="input"
                    value={swipeTagSearchText}
                    onChange={(event) => setSwipeTagSearchText(event.target.value)}
                    placeholder="например: sandbox, corruption"
                  />
                </div>

                <div className="swipeFilterModalGroupGrid">
                  {renderSwipeFilterOptionGroup(
                    "Включить",
                    "tags[]",
                    filteredSwipeTagOptions,
                    sessionState.filterState.includeTagIds,
                    toggleSwipeIncludeTag,
                    "include",
                    `${sessionState.filterState.includeTagIds.length}/${MAX_TAG_FILTERS_PER_GROUP}`,
                  )}
                  {renderSwipeFilterOptionGroup(
                    "Выключить",
                    "notags[]",
                    filteredSwipeTagOptions,
                    sessionState.filterState.excludeTagIds,
                    toggleSwipeExcludeTag,
                    "exclude",
                    `${sessionState.filterState.excludeTagIds.length}/${MAX_TAG_FILTERS_PER_GROUP}`,
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

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
        primaryActionLabel={getLauncherPrimaryActionLabel(
          isLauncherAvailable,
          downloadModalState.threadLink
            ? launcherGamesByThreadLink[downloadModalState.threadLink] ?? null
            : null,
        )}
        isPrimaryActionDisabled={isLauncherGameBusy(
          downloadModalState.threadLink
            ? launcherGamesByThreadLink[downloadModalState.threadLink] ?? null
            : null,
        )}
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
