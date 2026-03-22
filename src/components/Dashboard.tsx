import { useDeferredValue, useEffect, useMemo, useState } from "react";
import type { MouseEvent } from "react";
import type { ListType, ProcessedThreadItem, SessionState } from "../f95/types";
import {
  assessThreadInterest,
  buildInterestProfile,
  type InterestCandidate,
  type ThreadInterestAssessment,
} from "../f95/recommendations";
import {
  countUpdatedTrackedItems,
  getProcessedThreadItemUpdateLabel,
  hasProcessedThreadItemUpdate,
} from "../f95/updateTracking";
import {
  getLauncherPrimaryActionLabel,
  isLauncherGameBusy,
} from "../launcher/ui";
import type { LauncherGameRecord } from "../launcher/types";
import { TagChips } from "./TagChips";

type DashboardCard = {
  threadLink: string;
  coverUrl: string;
  title: string;
  creator: string;
  engineLabel: string;
  rating: number;
  version: string;
  isUpdated: boolean;
  tags: number[];
  addedAt: number;
  isPlayed: boolean;
  isInFavorites: boolean;
  isPlayedFavorite: boolean;
  isInTrash: boolean;
  listType: ListType | null;
  sectionKey: "favorite" | "trash" | "played";
  interestAssessment: ThreadInterestAssessment | null;
  interestScore: number;
};

type DashboardSortField = "addedAt" | "rating" | "title" | "interest";

type DashboardTabId = "bookmarks" | "trash" | "played";

type DashboardProps = {
  sessionState: SessionState;
  isLauncherAvailable: boolean;
  launcherGamesByThreadLink: Record<string, LauncherGameRecord>;
  openBestDownloadForThread: (
    threadLink: string,
    threadTitle: string,
    options?: {
      openInBackground?: boolean;
    },
  ) => void | Promise<void>;
  onOpenThread: (threadLink: string) => void | Promise<void>;
  onOpenImageViewer: (imageUrlList: string[], startIndex: number) => void;
  tagsMap: Record<string, string>;
  prefixesMap: Record<string, string>;
  onRevealInstalledGame: (threadLink: string) => void | Promise<void>;
  onDeleteGameFilesForThread: (
    threadLink: string,
    threadTitle: string,
  ) => void | Promise<void>;
  onChooseInstallFolderForThread: (
    threadLink: string,
    threadTitle: string,
  ) => void | Promise<void>;
  onChooseLaunchTargetForThread: (threadLink: string) => void | Promise<void>;
  onOpenErrorMirrorForThread: (
    threadLink: string,
    threadTitle: string,
  ) => void | Promise<void>;
  moveLinkToList: (link: string, listType: ListType) => void;
  togglePlayedFavoriteLink: (link: string) => void;
  removeLinkFromList: (link: string, listType: ListType) => void;
  pickCoverForLink: (
    threadLink: string,
    processedThreadItemsByLink: Record<string, ProcessedThreadItem>,
    threadItemsByIdentifier: Record<string, { cover?: string }>,
  ) => string;
  pickTitleForLink: (
    threadLink: string,
    processedThreadItemsByLink: Record<string, ProcessedThreadItem>,
    threadItemsByIdentifier: Record<string, { title?: string }>,
  ) => string;
  pickCreatorForLink: (
    threadLink: string,
    processedThreadItemsByLink: Record<string, ProcessedThreadItem>,
    threadItemsByIdentifier: Record<string, { creator?: string }>,
  ) => string;
  pickRatingForLink: (
    threadLink: string,
    processedThreadItemsByLink: Record<string, ProcessedThreadItem>,
    threadItemsByIdentifier: Record<string, { rating?: number }>,
  ) => number;
};

type GameSettingsModalState = {
  threadLink: string;
  threadTitle: string;
  coverUrl: string;
};

const parseThreadIdentifierFromLink = (threadLink: string) => {
  const match = /\/threads\/(\d+)/.exec(threadLink);
  if (!match) {
    return null;
  }
  return Number(match[1]);
};

const normalizeText = (value: string) => value.trim().toLowerCase();

const INITIAL_VISIBLE_CARD_COUNT = 120;
const VISIBLE_CARD_COUNT_STEP = 120;

const createInitialVisibleCardCounts = (): Record<DashboardTabId, number> => ({
  bookmarks: INITIAL_VISIBLE_CARD_COUNT,
  trash: INITIAL_VISIBLE_CARD_COUNT,
  played: INITIAL_VISIBLE_CARD_COUNT,
});

const sortCards = (
  cards: DashboardCard[],
  sortField: DashboardSortField,
  sortDirection: "desc" | "asc",
) => {
  const multiplier = sortDirection === "desc" ? -1 : 1;
  return [...cards].sort((first, second) => {
    let comparison = 0;
    if (sortField === "addedAt") {
      comparison = first.addedAt - second.addedAt;
    } else if (sortField === "rating") {
      comparison = first.rating - second.rating;
    } else if (sortField === "interest") {
      comparison = first.interestScore - second.interestScore;
    } else {
      comparison = first.title.localeCompare(second.title);
    }

    if (comparison === 0) {
      comparison = first.addedAt - second.addedAt;
    }

    return comparison * multiplier;
  });
};

const formatLauncherStatus = (launcherGame: LauncherGameRecord | null) => {
  if (!launcherGame) {
    return "Нет данных";
  }

  if (launcherGame.status === "queued") {
    return "В очереди";
  }
  if (launcherGame.status === "resolving") {
    return "Подготовка";
  }
  if (launcherGame.status === "downloading") {
    return typeof launcherGame.progressPercent === "number"
      ? `Скачивание ${launcherGame.progressPercent}%`
      : "Скачивание";
  }
  if (launcherGame.status === "extracting") {
    return "Распаковка";
  }
  if (launcherGame.status === "installed") {
    return "Установлена";
  }
  return "Ошибка";
};

const compactNumberFormatter = new Intl.NumberFormat("ru-RU", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const shortDateFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

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

const formatDateTimeLabel = (unixSeconds: number | undefined) => {
  if (
    typeof unixSeconds !== "number" ||
    !Number.isFinite(unixSeconds) ||
    unixSeconds <= 0
  ) {
    return "Не указана";
  }

  return dateTimeFormatter.format(new Date(unixSeconds * 1000));
};

const formatStorageSizeLabel = (value: number | null | undefined) => {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return null;
  }

  const unitList = ["Б", "КБ", "МБ", "ГБ", "ТБ"];
  let nextValue = value;
  let unitIndex = 0;

  while (nextValue >= 1024 && unitIndex < unitList.length - 1) {
    nextValue /= 1024;
    unitIndex += 1;
  }

  const fractionDigits = nextValue >= 10 || unitIndex === 0 ? 0 : 1;
  const formattedValue = nextValue.toFixed(fractionDigits).replace(/\.0$/, "");
  return `${formattedValue} ${unitList[unitIndex]}`;
};

const formatListTypeLabel = (value: ListType | null) => {
  if (value === "favorite") {
    return "Закладки";
  }
  if (value === "trash") {
    return "Мусор";
  }
  if (value === "played") {
    return "Играл";
  }
  return "Не определен";
};

const buildPrefixLabels = (
  prefixIdList: number[] | undefined,
  prefixesMap: Record<string, string>,
) => {
  if (!Array.isArray(prefixIdList)) {
    return [];
  }

  return Array.from(
    new Set(
      prefixIdList.filter(
        (prefixId): prefixId is number => typeof prefixId === "number",
      ),
    ),
  ).map((prefixId) => prefixesMap[String(prefixId)] ?? `#${prefixId}`);
};

const buildInterestCandidate = (
  processedItem: ProcessedThreadItem | null | undefined,
  threadItem:
    | {
        tags?: number[];
        prefixes?: number[];
        creator?: string;
        rating?: number;
        new?: boolean;
      }
    | null
    | undefined,
): InterestCandidate => {
  return {
    tags: Array.isArray(threadItem?.tags)
      ? threadItem.tags
      : Array.isArray(processedItem?.tags)
        ? processedItem.tags
        : [],
    prefixes: Array.isArray(threadItem?.prefixes)
      ? threadItem.prefixes
      : Array.isArray(processedItem?.prefixes)
        ? processedItem.prefixes
        : [],
    creator:
      typeof threadItem?.creator === "string"
        ? threadItem.creator
        : typeof processedItem?.creator === "string"
          ? processedItem.creator
          : "",
    rating:
      typeof threadItem?.rating === "number"
        ? threadItem.rating
        : typeof processedItem?.rating === "number"
          ? processedItem.rating
          : 0,
    new: Boolean(threadItem?.new),
  };
};

export const Dashboard = ({
  sessionState,
  isLauncherAvailable,
  launcherGamesByThreadLink,
  openBestDownloadForThread,
  onOpenThread,
  onOpenImageViewer,
  tagsMap,
  prefixesMap,
  onRevealInstalledGame,
  onDeleteGameFilesForThread,
  onChooseInstallFolderForThread,
  onChooseLaunchTargetForThread,
  onOpenErrorMirrorForThread,
  moveLinkToList,
  togglePlayedFavoriteLink,
  removeLinkFromList,
  pickCoverForLink,
  pickTitleForLink,
  pickCreatorForLink,
  pickRatingForLink,
}: DashboardProps) => {
  const [searchText, setSearchText] = useState("");
  const [includeTags, setIncludeTags] = useState<string[]>([]);
  const [excludeTags, setExcludeTags] = useState<string[]>([]);
  const [isSearchAndSortOpen, setIsSearchAndSortOpen] = useState(false);
  const [isIncludeTagsOpen, setIsIncludeTagsOpen] = useState(false);
  const [isExcludeTagsOpen, setIsExcludeTagsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<DashboardTabId>("bookmarks");
  const [onlyUpdatedTracked, setOnlyUpdatedTracked] = useState(false);
  const [showOnlyPlayedFavorites, setShowOnlyPlayedFavorites] = useState(false);
  const [sortField, setSortField] = useState<DashboardSortField>("addedAt");
  const [sortDirection, setSortDirection] = useState<"desc" | "asc">("asc");
  const [showInterestBadges, setShowInterestBadges] = useState(true);
  const [visibleCardCountByTab, setVisibleCardCountByTab] = useState(
    createInitialVisibleCardCounts,
  );
  const [activeGameCard, setActiveGameCard] = useState<DashboardCard | null>(
    null,
  );
  const [gameSettingsModalState, setGameSettingsModalState] =
    useState<GameSettingsModalState | null>(null);
  const [isGameSettingsBusy, setIsGameSettingsBusy] = useState(false);
  const playedLinks = useMemo(
    () => sessionState.playedLinks,
    [sessionState.playedLinks],
  );
  const deferredSearchText = useDeferredValue(searchText);
  const favoritesLinkSet = useMemo(
    () => new Set(sessionState.favoritesLinks),
    [sessionState.favoritesLinks],
  );
  const playedFavoriteLinkSet = useMemo(
    () => new Set(sessionState.playedFavoriteLinks),
    [sessionState.playedFavoriteLinks],
  );
  const trashLinkSet = useMemo(
    () => new Set(sessionState.trashLinks),
    [sessionState.trashLinks],
  );
  const playedLinkSet = useMemo(() => new Set(playedLinks), [playedLinks]);

  const trackedLinks = useMemo(() => {
    const linkSet = new Set<string>();
    for (const link of favoritesLinkSet) {
      linkSet.add(link);
    }
    for (const link of trashLinkSet) {
      linkSet.add(link);
    }
    for (const link of playedLinkSet) {
      linkSet.add(link);
    }
    return Array.from(linkSet);
  }, [favoritesLinkSet, trashLinkSet, playedLinkSet]);

  const availableTagOptions = useMemo(() => {
    const tagSet = new Set<number>();
    for (const link of trackedLinks) {
      const processedItem = sessionState.processedThreadItemsByLink[link];
      if (processedItem?.tags) {
        processedItem.tags.forEach((tagValue) => tagSet.add(tagValue));
      }
    }
    const tagEntries = Array.from(tagSet).map((tagValue) => ({
      id: String(tagValue),
      label: tagsMap[String(tagValue)] ?? `#${tagValue}`,
    }));
    return tagEntries.sort((first, second) =>
      first.label.localeCompare(second.label),
    );
  }, [sessionState.processedThreadItemsByLink, trackedLinks, tagsMap]);

  const includeTagNumbers = useMemo(
    () => includeTags.map((tagId) => Number(tagId)).filter(Number.isFinite),
    [includeTags],
  );

  const excludeTagNumbers = useMemo(
    () => excludeTags.map((tagId) => Number(tagId)).filter(Number.isFinite),
    [excludeTags],
  );

  const normalizedSearchText = useMemo(
    () => normalizeText(deferredSearchText),
    [deferredSearchText],
  );

  const interestProfile = useMemo(
    () => buildInterestProfile(sessionState),
    [
      sessionState.favoritesLinks,
      sessionState.playedFavoriteLinks,
      sessionState.playedLinks,
      sessionState.processedThreadItemsByLink,
      sessionState.trashLinks,
    ],
  );

  useEffect(() => {
    setVisibleCardCountByTab(createInitialVisibleCardCounts());
  }, [
    normalizedSearchText,
    includeTagNumbers,
    excludeTagNumbers,
    onlyUpdatedTracked,
    showOnlyPlayedFavorites,
    sortField,
    sortDirection,
  ]);

  const sortFieldLabel =
    sortField === "addedAt"
      ? "Дата добавления"
      : sortField === "rating"
        ? "Рейтинг"
        : sortField === "interest"
          ? "Вес"
        : "Название";

  const sortDirectionLabel =
    sortDirection === "desc" ? "По убыванию" : "По возрастанию";

  const searchAndSortSummary = [
    searchText.trim() ? `Поиск: ${searchText.trim()}` : null,
    `${sortFieldLabel}, ${sortDirectionLabel.toLowerCase()}`,
    onlyUpdatedTracked ? "только обновленные" : null,
    activeTab === "played" && showOnlyPlayedFavorites ? "только любимые" : null,
    showInterestBadges ? null : "оценки скрыты",
  ]
    .filter(Boolean)
    .join(" • ");

  const buildTags = (threadLink: string) => {
    const processedItem = sessionState.processedThreadItemsByLink[threadLink];
    if (processedItem?.tags && processedItem.tags.length > 0) {
      return processedItem.tags;
    }

    const threadIdentifier = parseThreadIdentifierFromLink(threadLink);
    if (threadIdentifier === null) {
      return [];
    }

    const threadItem =
      sessionState.threadItemsByIdentifier[String(threadIdentifier)];
    if (!threadItem || !Array.isArray(threadItem.tags)) {
      return [];
    }

    return threadItem.tags;
  };

  const matchesTagFilters = (tags: number[]) => {
    const includeMatch =
      includeTagNumbers.length === 0 ||
      includeTagNumbers.every((tagValue) => tags.includes(tagValue));
    const excludeMatch =
      excludeTagNumbers.length === 0 ||
      excludeTagNumbers.every((tagValue) => !tags.includes(tagValue));
    return includeMatch && excludeMatch;
  };

  const createCards = (
    links: string[],
    sectionKey: DashboardCard["sectionKey"],
  ) => {
    const filteredCards: DashboardCard[] = [];
    const seenLinks = new Set<string>();
    for (const threadLink of links) {
      if (seenLinks.has(threadLink)) {
        continue;
      }
      seenLinks.add(threadLink);

      const title = pickTitleForLink(
        threadLink,
        sessionState.processedThreadItemsByLink,
        sessionState.threadItemsByIdentifier,
      );
      const creator = pickCreatorForLink(
        threadLink,
        sessionState.processedThreadItemsByLink,
        sessionState.threadItemsByIdentifier,
      );

      const combinedText = normalizeText(`${title} ${creator}`);
      if (
        normalizedSearchText &&
        !combinedText.includes(normalizedSearchText)
      ) {
        continue;
      }

      const cardTags = buildTags(threadLink);
      if (!matchesTagFilters(cardTags)) {
        continue;
      }

      const processedItem = sessionState.processedThreadItemsByLink[threadLink];
      const isUpdated = hasProcessedThreadItemUpdate(processedItem);
      if (onlyUpdatedTracked && sectionKey !== "trash" && !isUpdated) {
        continue;
      }

      const isInFavorites = favoritesLinkSet.has(threadLink);
      const isPlayedFavorite = playedFavoriteLinkSet.has(threadLink);
      const isInTrash = trashLinkSet.has(threadLink);
      const isPlayed = playedLinkSet.has(threadLink);
      if (sectionKey === "played" && showOnlyPlayedFavorites && !isPlayedFavorite) {
        continue;
      }

      const threadIdentifier = parseThreadIdentifierFromLink(threadLink);
      const threadItem =
        threadIdentifier !== null
          ? sessionState.threadItemsByIdentifier[String(threadIdentifier)]
          : null;
      const interestAssessment = assessThreadInterest(
        buildInterestCandidate(processedItem, threadItem),
        interestProfile,
        tagsMap,
        prefixesMap,
      );
      const version =
        processedItem?.version?.trim() ||
        (typeof threadItem?.version === "string" ? threadItem.version : "");
      const engineLabel = buildPrefixLabels(
        Array.isArray(threadItem?.prefixes)
          ? threadItem.prefixes
          : processedItem?.prefixes,
        prefixesMap,
      ).join(", ");

      filteredCards.push({
        threadLink,
        coverUrl: pickCoverForLink(
          threadLink,
          sessionState.processedThreadItemsByLink,
          sessionState.threadItemsByIdentifier,
        ),
        title,
        creator,
        engineLabel,
        rating: pickRatingForLink(
          threadLink,
          sessionState.processedThreadItemsByLink,
          sessionState.threadItemsByIdentifier,
        ),
        version,
        isUpdated,
        tags: cardTags,
        addedAt: processedItem?.addedAtUnixSeconds ?? 0,
        isPlayed,
        isInFavorites,
        isPlayedFavorite,
        isInTrash,
        listType: sectionKey,
        sectionKey,
        interestAssessment,
        interestScore: interestAssessment?.score ?? 50,
      });
    }

    return sortCards(filteredCards, sortField, sortDirection);
  };

  const activeCards = useMemo(() => {
    if (activeTab === "bookmarks") {
      return createCards(sessionState.favoritesLinks, "favorite");
    }
    if (activeTab === "trash") {
      return createCards(sessionState.trashLinks, "trash");
    }
    return createCards(playedLinks, "played");
  }, [
    activeTab,
    sessionState.favoritesLinks,
    sessionState.trashLinks,
    playedLinks,
    sessionState.processedThreadItemsByLink,
    sessionState.threadItemsByIdentifier,
    favoritesLinkSet,
    playedFavoriteLinkSet,
    trashLinkSet,
    playedLinkSet,
    sortField,
    sortDirection,
    normalizedSearchText,
    onlyUpdatedTracked,
    includeTagNumbers,
    excludeTagNumbers,
    pickCoverForLink,
    pickTitleForLink,
    pickCreatorForLink,
    pickRatingForLink,
    interestProfile,
    tagsMap,
    prefixesMap,
    showOnlyPlayedFavorites,
  ]);

  const visibleCardCount = visibleCardCountByTab[activeTab];
  const visibleCards = useMemo(
    () => activeCards.slice(0, visibleCardCount),
    [activeCards, visibleCardCount],
  );

  const toggleIncludeTag = (tagId: string) => {
    setIncludeTags((previous) => {
      if (previous.includes(tagId)) {
        return previous.filter((value) => value !== tagId);
      }
      return [...previous, tagId].filter(
        (value) => !excludeTags.includes(value),
      );
    });
  };

  const toggleExcludeTag = (tagId: string) => {
    setExcludeTags((previous) => {
      if (previous.includes(tagId)) {
        return previous.filter((value) => value !== tagId);
      }
      return [...previous, tagId].filter(
        (value) => !includeTags.includes(value),
      );
    });
  };

  const toggleSortDirection = () => {
    setSortDirection((previous) => (previous === "desc" ? "asc" : "desc"));
  };

  const favoritesUpdatedCount = useMemo(
    () =>
      countUpdatedTrackedItems(
        sessionState.favoritesLinks,
        sessionState.processedThreadItemsByLink,
      ),
    [sessionState.favoritesLinks, sessionState.processedThreadItemsByLink],
  );

  const playedUpdatedCount = useMemo(
    () =>
      countUpdatedTrackedItems(
        playedLinks,
        sessionState.processedThreadItemsByLink,
      ),
    [playedLinks, sessionState.processedThreadItemsByLink],
  );

  const renderTagFilterPanel = (
    title: string,
    selectedTagIds: string[],
    isOpen: boolean,
    onToggleOpen: () => void,
    onToggleTag: (tagId: string) => void,
  ) => {
    const selectedCount = selectedTagIds.length;

    return (
      <div className="tagFilterPanel">
        <button
          className="tagFilterHeader"
          type="button"
          onClick={onToggleOpen}
          aria-expanded={isOpen}
        >
          <span className="tagFilterHeaderText">
            <span className="label">{title}</span>
            <span className="tagFilterHeaderMeta">
              {selectedCount > 0
                ? `Выбрано: ${selectedCount}`
                : "Ничего не выбрано"}
            </span>
          </span>
          <span className="tagFilterHeaderToggle">
            {isOpen ? "Скрыть" : "Показать"}
          </span>
        </button>

        {isOpen ? (
          <div className="tagFilterBody">
            <div className="tagFilterChips">
              {availableTagOptions.map((option) => (
                <button
                  key={`${title}-${option.id}`}
                  type="button"
                  className={`tagFilterChip ${
                    selectedTagIds.includes(option.id)
                      ? "tagFilterChipActive"
                      : ""
                  }`}
                  onClick={() => onToggleTag(option.id)}
                >
                  {option.label}
                </button>
              ))}
              {!availableTagOptions.length ? (
                <span className="smallText">Нет меток</span>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    );
  };

  const tabItems = [
    {
      id: "bookmarks" as const,
      label: "Закладки",
      updatedCount: favoritesUpdatedCount,
    },
    {
      id: "trash" as const,
      label: "Мусор",
      updatedCount: 0,
    },
    {
      id: "played" as const,
      label: "Играл",
      updatedCount: playedUpdatedCount,
    },
  ];

  const activeTabItem =
    tabItems.find((item) => item.id === activeTab) ?? tabItems[0];
  const activeCardsCountLabel =
    activeTabItem.id === "played" && showOnlyPlayedFavorites
      ? `${activeCards.length} из ${playedLinks.length} игр`
      : `${activeCards.length} игр`;
  const showActiveUpdatedCount =
    activeTabItem.updatedCount > 0 &&
    activeTabItem.id !== "trash" &&
    !(activeTabItem.id === "played" && showOnlyPlayedFavorites);

  const activeGameThreadIdentifier = activeGameCard
    ? parseThreadIdentifierFromLink(activeGameCard.threadLink)
    : null;
  const activeGameThreadItem =
    activeGameThreadIdentifier !== null
      ? sessionState.threadItemsByIdentifier[String(activeGameThreadIdentifier)] ??
        null
      : null;
  const activeGameProcessedItem = activeGameCard
    ? sessionState.processedThreadItemsByLink[activeGameCard.threadLink] ?? null
    : null;
  const activeGamePrefixLabels = buildPrefixLabels(
    Array.isArray(activeGameThreadItem?.prefixes)
      ? activeGameThreadItem.prefixes
      : activeGameProcessedItem?.prefixes,
    prefixesMap,
  );
  const activeGameFactPills = activeGameCard
    ? [
        { label: "Рейтинг", value: String(activeGameCard.rating ?? 0) },
        {
          label: "Лайки",
          value: formatCompactNumber(activeGameThreadItem?.likes),
        },
        {
          label: "Просмотры",
          value: formatCompactNumber(activeGameThreadItem?.views),
        },
        {
          label: "Дата",
          value: formatThreadDateLabel(activeGameThreadItem?.date),
        },
      ]
    : [];
  const activeGameStateBadges = activeGameCard
    ? [
        activeGameCard.isUpdated ? "Есть апдейт" : null,
        activeGameThreadItem?.new ? "New" : null,
        activeGameThreadItem?.watched ? "Watched" : null,
        activeGameThreadItem?.ignored ? "Ignored" : null,
      ].filter((value): value is string => Boolean(value))
    : [];
  const activeGameUpdateLabel = getProcessedThreadItemUpdateLabel(
    activeGameProcessedItem,
  );
  const activeGameInfoCards = activeGameCard
    ? [
        {
          label: "Автор",
          value: activeGameCard.creator || "Unknown",
        },
        {
          label: "Версия",
          value: activeGameCard.version
            ? `v${activeGameCard.version}`
            : "Не указана",
        },
        {
          label: "Список",
          value: formatListTypeLabel(activeGameCard.listType),
        },
        {
          label: "Добавлена",
          value: formatDateTimeLabel(activeGameCard.addedAt),
        },
        {
          label: "Thread ID",
          value:
            activeGameThreadIdentifier !== null
              ? String(activeGameThreadIdentifier)
              : "Не найден",
        },
        {
          label: "Трекер",
          value: activeGameUpdateLabel ?? "Без новых апдейтов",
        },
      ]
    : [];
  const activeGameScreens = activeGameThreadItem?.screens ?? [];
  const activeGameLauncherRecord = activeGameCard
    ? launcherGamesByThreadLink[activeGameCard.threadLink] ?? null
    : null;
  const isActiveGameLauncherBusy = isLauncherGameBusy(activeGameLauncherRecord);

  const activeGameSettingsRecord = useMemo(() => {
    if (!gameSettingsModalState) {
      return null;
    }

    return launcherGamesByThreadLink[gameSettingsModalState.threadLink] ?? null;
  }, [gameSettingsModalState, launcherGamesByThreadLink]);
  const canRevealActiveGameSettingsRecord = Boolean(
    activeGameSettingsRecord?.launchTargetPath ??
      activeGameSettingsRecord?.installDir ??
      activeGameSettingsRecord?.archivePath,
  );

  useEffect(() => {
    if (
      gameSettingsModalState &&
      !launcherGamesByThreadLink[gameSettingsModalState.threadLink]
    ) {
      setGameSettingsModalState(null);
      setIsGameSettingsBusy(false);
    }
  }, [gameSettingsModalState, launcherGamesByThreadLink]);

  useEffect(() => {
    if (!activeGameCard) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActiveGameCard(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeGameCard]);

  const runGameSettingsAction = (action: () => void | Promise<void>) => {
    setIsGameSettingsBusy(true);
    void Promise.resolve(action()).finally(() => {
      setIsGameSettingsBusy(false);
    });
  };

  const renderCardActions = (card: DashboardCard) => {
    const isInFavorites = card.isInFavorites;
    const isInTrash = card.isInTrash;
    const isPlayed = card.isPlayed;
    const showFavoriteQuickAction = !isInFavorites;
    const launcherGame = launcherGamesByThreadLink[card.threadLink] ?? null;
    const canOpenGameSettings = isLauncherAvailable && Boolean(launcherGame);
    const showInstallFolderButton = isLauncherAvailable;
    const isInstalled = launcherGame?.status === "installed";
    const canLaunchInstalledGame =
      isInstalled && Boolean(launcherGame?.launchTargetPath);
    const isBusy = isLauncherGameBusy(launcherGame);
    const isError = launcherGame?.status === "error";
    const errorHint =
      isError &&
      (launcherGame.errorMessage?.trim() ||
        launcherGame.message?.trim() ||
        "Автоматическая загрузка завершилась ошибкой.");
    const errorHintLabel = errorHint
      ? `${errorHint} Нажми, чтобы открыть зеркало.`
      : null;
    const primaryActionSecondaryButtonCount =
      Number(showInstallFolderButton) +
      Number(canOpenGameSettings) +
      Number(Boolean(errorHint));
    const quickActionCount =
      Number(!isPlayed) + Number(showFavoriteQuickAction) + Number(!isInTrash) + 1;

    const handleDangerClick = () => {
      if (card.sectionKey === "played") {
        removeLinkFromList(card.threadLink, "played");
        return;
      }
      removeLinkFromList(card.threadLink, card.sectionKey as ListType);
    };

    const handleBestDownloadMiddleMouseDown = (
      event: MouseEvent<HTMLButtonElement>,
    ) => {
      if (event.button !== 1) {
        return;
      }

      // Prevent the browser autoscroll gesture on middle click.
      event.preventDefault();
    };

    const handleBestDownloadAuxClick = (
      event: MouseEvent<HTMLButtonElement>,
    ) => {
      if (event.button !== 1) {
        return;
      }

      event.preventDefault();
      void openBestDownloadForThread(card.threadLink, card.title, {
        openInBackground: true,
      });
    };

    return (
      <div className="listItemActionsRow">
        <div
          className="listItemPrimaryActions"
          style={{
            gridTemplateColumns:
              primaryActionSecondaryButtonCount > 0
                ? `minmax(0, 1fr) repeat(${primaryActionSecondaryButtonCount}, 46px)`
                : "minmax(0, 1fr)",
          }}
        >
          <button
            className={`button listItemDownloadButton listItemBestDownloadButton ${
              canLaunchInstalledGame ? "listItemPlayButton" : ""
            } ${isBusy ? "listItemBusyButton" : ""}`}
            type="button"
            onMouseDown={handleBestDownloadMiddleMouseDown}
            onAuxClick={handleBestDownloadAuxClick}
            disabled={isBusy}
            onClick={() => {
              void openBestDownloadForThread(card.threadLink, card.title);
            }}
          >
            {getLauncherPrimaryActionLabel(isLauncherAvailable, launcherGame)}
          </button>
          {showInstallFolderButton ? (
            <button
              className="button listItemDownloadButton listItemSettingsButton"
              type="button"
              title="Указать папку игры"
              aria-label="Указать папку игры"
              disabled={isBusy}
              onClick={() => {
                void onChooseInstallFolderForThread(card.threadLink, card.title);
              }}
            >
              <span aria-hidden>📁</span>
              <span className="srOnly">Указать папку игры</span>
            </button>
          ) : null}
          {canOpenGameSettings ? (
            <button
              className="button listItemDownloadButton listItemSettingsButton"
              type="button"
              title="Настройки игры"
              aria-label="Настройки игры"
              disabled={isBusy}
              onClick={() => {
                setGameSettingsModalState({
                  threadLink: card.threadLink,
                  threadTitle: card.title,
                  coverUrl: card.coverUrl,
                });
              }}
            >
              <span aria-hidden>⚙</span>
              <span className="srOnly">Настройки игры</span>
            </button>
          ) : null}
          {errorHint ? (
            <button
              className="button listItemStatusHintButton"
              type="button"
              title={errorHintLabel ?? undefined}
              aria-label={errorHintLabel ?? undefined}
              disabled={isBusy}
              onClick={() => {
                void onOpenErrorMirrorForThread(card.threadLink, card.title);
              }}
            >
              !
            </button>
          ) : null}
        </div>
        <div
          className="listItemQuickActions"
          style={{
            gridTemplateColumns: `repeat(${quickActionCount}, minmax(0, 1fr))`,
          }}
        >
          {!isPlayed ? (
            <button
              className="iconButton listItemActionIconButton iconButtonPlayed"
              onClick={() => {
                moveLinkToList(card.threadLink, "played");
              }}
              title="Перенести в Играл"
              aria-label="Перенести в Играл"
            >
              <span aria-hidden>🎮</span>
              <span className="srOnly">Перенести в Играл</span>
            </button>
          ) : null}
          {showFavoriteQuickAction ? (
            <button
              className="iconButton listItemActionIconButton iconButtonStar"
              onClick={() => {
                moveLinkToList(card.threadLink, "favorite");
              }}
              title="Добавить в закладки"
              aria-label="Добавить в закладки"
            >
              <span aria-hidden>★</span>
              <span className="srOnly">Добавить в закладки</span>
            </button>
          ) : null}
          {!isInTrash ? (
            <button
              className="iconButton listItemActionIconButton iconButtonTrash"
              onClick={() => {
                moveLinkToList(card.threadLink, "trash");
              }}
              title="Перенести в мусор"
              aria-label="Перенести в мусор"
            >
              <span aria-hidden>🗑</span>
              <span className="srOnly">Перенести в мусор</span>
            </button>
          ) : null}
          <button
            className="iconButton listItemActionIconButton iconButtonDanger"
            onClick={handleDangerClick}
            title={
              card.sectionKey === "played"
                ? "Снять отметку Играл"
                : "Удалить из списка"
            }
            aria-label={
              card.sectionKey === "played"
                ? "Снять отметку Играл"
                : "Удалить из списка"
            }
          >
            <span aria-hidden>✖</span>
            <span className="srOnly">
              {card.sectionKey === "played"
                ? "Снять отметку Играл"
                : "Удалить из списка"}
            </span>
          </button>
        </div>
      </div>
    );
  };

  const renderCardsList = (
    cards: DashboardCard[],
    totalCardsCount: number,
    tabId: DashboardTabId,
  ) => {
    if (totalCardsCount === 0) {
      return (
        <div className="statusBox dashboardEmptyState">
          <div style={{ fontWeight: 900, fontSize: 18 }}>
            В этом списке пока ничего нет
          </div>
          <div className="mutedText">
            {tabId === "played" && showOnlyPlayedFavorites
              ? "Во вкладке Играл пока нет игр, отмеченных как любимые."
              : onlyUpdatedTracked && tabId !== "trash"
              ? "Сейчас нет карточек с апдейтом. Попробуй снять фильтр или дождаться следующей синхронизации."
              : "Попробуй сменить вкладку или ослабить фильтры поиска и тегов."}
          </div>
        </div>
      );
    }

    const remainingCardsCount = totalCardsCount - cards.length;

    return (
      <>
        <div className="listGrid" style={{ marginTop: 12 }}>
          {cards.map((card) => {
            const launcherGame = launcherGamesByThreadLink[card.threadLink] ?? null;
            const installedSizeLabel =
              launcherGame?.status === "installed"
                ? formatStorageSizeLabel(launcherGame.sizeBytes)
                : null;
            const showPlayedFavoriteButton = card.sectionKey === "played";
            const playedFavoriteLabel = card.isPlayedFavorite
              ? "Убрать из любимого"
              : "Добавить в любимое";
            const handleCardMiddleMouseDown = (
              event: MouseEvent<HTMLButtonElement>,
            ) => {
              if (event.button !== 1) {
                return;
              }

              // Prevent the browser autoscroll gesture on middle click.
              event.preventDefault();
            };

            const handleCardAuxClick = (
              event: MouseEvent<HTMLButtonElement>,
            ) => {
              if (event.button !== 1) {
                return;
              }

              event.preventDefault();
              void onOpenThread(card.threadLink);
            };

            return (
              <div
                key={card.threadLink}
                className={`listItemCard ${
                  card.isUpdated ? "listItemCardUpdated" : ""
                }`}
              >
                {showInterestBadges && card.interestAssessment ? (
                  <div
                    className={`dashboardInterestBadge swipeInterestBadge swipeInterestBadge${card.interestAssessment.level[0].toUpperCase()}${card.interestAssessment.level.slice(1)}`}
                    title={`${card.interestAssessment.label} · ${card.interestScore}/100. ${card.interestAssessment.summary}`}
                  >
                    {card.interestAssessment.label}
                  </div>
                ) : null}
                {showPlayedFavoriteButton ? (
                  <button
                    className={`iconButton listItemFavoriteFloatingButton ${
                      card.isPlayedFavorite
                        ? "listItemFavoriteFloatingButtonActive"
                        : ""
                    }`}
                    type="button"
                    onClick={() => {
                      togglePlayedFavoriteLink(card.threadLink);
                    }}
                    title={playedFavoriteLabel}
                    aria-label={playedFavoriteLabel}
                  >
                    <span aria-hidden>♥</span>
                    <span className="srOnly">{playedFavoriteLabel}</span>
                  </button>
                ) : null}
                <button
                  className="listItemOpenSurface"
                  type="button"
                  onMouseDown={handleCardMiddleMouseDown}
                  onAuxClick={handleCardAuxClick}
                  onClick={() => setActiveGameCard(card)}
                >
                  <div className="listItemCoverLink">
                    {card.coverUrl ? (
                      <img
                        className="listItemCover"
                        src={card.coverUrl}
                        alt={card.title}
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      <div className="listItemCover" />
                    )}
                  </div>

                  <div className="listItemBody listItemPreviewBody">
                    <div className="listItemContent">
                      {card.isUpdated ? (
                        <div className="listItemBadgeRow">
                          <span className="listItemStatusBadge listItemStatusBadgeUpdated">
                            Апдейт
                          </span>
                        </div>
                      ) : null}

                      <div className="listItemTitleRow">
                        <div className="listItemTitle" title={card.title}>
                          {card.title}
                        </div>
                      </div>

                      {card.engineLabel || card.version || installedSizeLabel ? (
                        <div className="listItemPreviewMeta">
                          <div className="listItemPreviewMetaDetails">
                            {card.engineLabel ? (
                              <span
                                className="listItemPreviewMetaItem"
                                title={card.engineLabel}
                              >
                                {card.engineLabel}
                              </span>
                            ) : null}
                            {card.version ? (
                              <span className="listItemPreviewMetaItem">
                                v{card.version}
                              </span>
                            ) : null}
                          </div>
                          {installedSizeLabel ? (
                            <span className="listItemPreviewMetaSize">
                              {installedSizeLabel}
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </button>

                <div className="listItemBody listItemActionBody">
                  {renderCardActions(card)}
                </div>
              </div>
            );
          })}
        </div>
        {remainingCardsCount > 0 ? (
          <div className="dashboardPagination">
            <div className="sectionMeta">
              Показано {cards.length} из {totalCardsCount} игр
            </div>
            <div className="dashboardPaginationActions">
              <button
                className="button"
                type="button"
                onClick={() =>
                  setVisibleCardCountByTab((previous) => ({
                    ...previous,
                    [tabId]: Math.min(
                      previous[tabId] + VISIBLE_CARD_COUNT_STEP,
                      totalCardsCount,
                    ),
                  }))
                }
              >
                Показать еще {Math.min(VISIBLE_CARD_COUNT_STEP, remainingCardsCount)}
              </button>
              <button
                className="button"
                type="button"
                onClick={() =>
                  setVisibleCardCountByTab((previous) => ({
                    ...previous,
                    [tabId]: totalCardsCount,
                  }))
                }
              >
                Показать все
              </button>
            </div>
          </div>
        ) : null}
      </>
    );
  };

  return (
    <div className="dashboard">
      <div className="dashboardTabBar" role="tablist" aria-label="Списки дашборда">
        {tabItems.map((item) => (
          <button
            key={`tab-${item.id}`}
            type="button"
            role="tab"
            aria-selected={activeTab === item.id}
            className={`button dashboardTabButton ${
              activeTab === item.id ? "dashboardTabButtonActive" : ""
            }`}
            onClick={() => setActiveTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="dashboardFilters">
        <div className="tagFilterPanel dashboardFilterPanel">
          <button
            className="tagFilterHeader"
            type="button"
            onClick={() => setIsSearchAndSortOpen((previous) => !previous)}
            aria-expanded={isSearchAndSortOpen}
          >
            <span className="tagFilterHeaderText">
              <span className="label">Поиск и сортировка</span>
              <span className="tagFilterHeaderMeta">{searchAndSortSummary}</span>
            </span>
            <span className="tagFilterHeaderToggle">
              {isSearchAndSortOpen ? "Скрыть" : "Показать"}
            </span>
          </button>

          {isSearchAndSortOpen ? (
            <div className="tagFilterBody dashboardFilterBody">
              <div className="formRow">
                <div className="label">Поиск по title / creator</div>
                <input
                  className="input"
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                  placeholder="например: team18"
                />
              </div>

              <div className="dashboardSortControls">
                <div className="formRow dashboardSortField">
                  <div className="label">Сортировка</div>
                  <select
                    className="input"
                    value={sortField}
                    onChange={(event) => {
                      const nextSortField = event.target.value as DashboardSortField;
                      setSortField(nextSortField);
                      if (nextSortField === "interest") {
                        setSortDirection("desc");
                      }
                    }}
                  >
                    <option value="addedAt">По дате добавления</option>
                    <option value="rating">По рейтингу</option>
                    <option value="interest">По весу</option>
                    <option value="title">По названию</option>
                  </select>
                </div>
                <div className="formRow dashboardSortDirectionField">
                  <div className="label">Направление</div>
                  <button
                    className="button dashboardSortDirectionButton"
                    type="button"
                    onClick={toggleSortDirection}
                  >
                    {sortDirectionLabel}
                  </button>
                </div>
              </div>

              <label className="dashboardPlayedFilterSwitch">
                <input
                  className="dashboardPlayedFilterSwitchInput"
                  type="checkbox"
                  checked={onlyUpdatedTracked}
                  onChange={(event) =>
                    setOnlyUpdatedTracked(event.target.checked)
                  }
                />
                <span className="dashboardPlayedFilterSwitchTrack" aria-hidden>
                  <span className="dashboardPlayedFilterSwitchThumb" />
                </span>
                <span>Только обновленные в закладках и Играл</span>
              </label>

              <label className="dashboardPlayedFilterSwitch">
                <input
                  className="dashboardPlayedFilterSwitchInput"
                  type="checkbox"
                  checked={showInterestBadges}
                  onChange={(event) =>
                    setShowInterestBadges(event.target.checked)
                  }
                />
                <span className="dashboardPlayedFilterSwitchTrack" aria-hidden>
                  <span className="dashboardPlayedFilterSwitchThumb" />
                </span>
                <span>Показывать оценки интереса на карточках</span>
              </label>

              {activeTab === "played" ? (
                <label className="dashboardPlayedFilterSwitch">
                  <input
                    className="dashboardPlayedFilterSwitchInput"
                    type="checkbox"
                    checked={showOnlyPlayedFavorites}
                    onChange={(event) =>
                      setShowOnlyPlayedFavorites(event.target.checked)
                    }
                  />
                  <span className="dashboardPlayedFilterSwitchTrack" aria-hidden>
                    <span className="dashboardPlayedFilterSwitchThumb" />
                  </span>
                  <span>Только любимые</span>
                </label>
              ) : null}

              <div className="smallText">
                Трекер сравнивает сохраненную `version/ts` с последней
                синхронизацией метаданных.
              </div>
            </div>
          ) : null}
        </div>

        <div className="tagFilterRow">
          {renderTagFilterPanel(
            "Include теги",
            includeTags,
            isIncludeTagsOpen,
            () => setIsIncludeTagsOpen((previous) => !previous),
            toggleIncludeTag,
          )}
          {renderTagFilterPanel(
            "Exclude теги",
            excludeTags,
            isExcludeTagsOpen,
            () => setIsExcludeTagsOpen((previous) => !previous),
            toggleExcludeTag,
          )}
        </div>
      </div>

      <div className="panel">
        <div className="sectionTitleRow">
          <div className="sectionTitle">{activeTabItem.label}</div>
          <div className="sectionTitleAside">
            <div className="sectionMeta">
              {activeCardsCountLabel}
              {showActiveUpdatedCount
                ? ` • обновились ${activeTabItem.updatedCount}`
                : ""}
            </div>
          </div>
        </div>
        {renderCardsList(visibleCards, activeCards.length, activeTabItem.id)}
      </div>

      {activeGameCard ? (
        <div
          className="downloadModalOverlay"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) {
              setActiveGameCard(null);
            }
          }}
        >
          <div className="downloadModal dashboardGameModal">
            <div className="downloadModalHeader">
              <div className="downloadModalTitleWrap gameSettingsTitleWrap">
                <div className="dashboardGameHero">
                  {activeGameCard.coverUrl ? (
                    <button
                      className="dashboardGameHeroCoverButton"
                      type="button"
                      onClick={() =>
                        onOpenImageViewer(
                          [
                            activeGameCard.coverUrl,
                            ...activeGameScreens,
                          ],
                          0,
                        )
                      }
                    >
                      <img
                        className="dashboardGameHeroCover"
                        src={activeGameCard.coverUrl}
                        alt={activeGameCard.title}
                      />
                    </button>
                  ) : (
                    <div className="dashboardGameHeroCover" />
                  )}

                  <div className="dashboardGameHeroText">
                    <div className="downloadModalTitle">
                      {activeGameCard.title}
                    </div>
                    <div className="dashboardGameHeroMeta">
                      {activeGameCard.creator ? (
                        <span>{activeGameCard.creator}</span>
                      ) : null}
                      {activeGameCard.version ? (
                        <span>v{activeGameCard.version}</span>
                      ) : null}
                      <span>{formatListTypeLabel(activeGameCard.listType)}</span>
                    </div>
                    <div className="downloadModalMeta">
                      {activeGameCard.threadLink}
                    </div>
                  </div>
                </div>
              </div>

              <div className="downloadModalActions">
                <button
                  className="button"
                  type="button"
                  onClick={() => {
                    void onOpenThread(activeGameCard.threadLink);
                  }}
                >
                  Открыть страницу
                </button>
                {isLauncherAvailable ? (
                  <button
                    className="button"
                    type="button"
                    disabled={isActiveGameLauncherBusy}
                    onClick={() => {
                      void onChooseInstallFolderForThread(
                        activeGameCard.threadLink,
                        activeGameCard.title,
                      );
                    }}
                  >
                    {activeGameLauncherRecord?.installDir
                      ? "Сменить папку"
                      : "Указать папку"}
                  </button>
                ) : null}
                <button
                  className="button"
                  type="button"
                  onClick={() => setActiveGameCard(null)}
                >
                  Закрыть
                </button>
              </div>
            </div>

            <div className="downloadModalBody">
              <div className="swipeMetaBody">
                <div className="cardFactRow">
                  {activeGameFactPills.map((fact) => (
                    <span key={fact.label} className="cardFactPill">
                      {fact.label}: <strong>{fact.value}</strong>
                    </span>
                  ))}
                </div>

                {activeGameStateBadges.length > 0 ? (
                  <div className="cardStateBadgeRow">
                    {activeGameStateBadges.map((badge) => (
                      <span key={badge} className="cardStateBadge">
                        {badge}
                      </span>
                    ))}
                  </div>
                ) : null}

                {activeGamePrefixLabels.length > 0 ? (
                  <div className="swipeMetaGroup">
                    <div className="swipeMetaGroupLabel">Префиксы</div>
                    <div className="tagChips">
                      {activeGamePrefixLabels.map((prefixLabel) => (
                        <span key={prefixLabel} className="tagChip">
                          {prefixLabel}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}

                {activeGameCard.tags.length > 0 ? (
                  <div className="swipeMetaGroup">
                    <div className="swipeMetaGroupLabel">Теги</div>
                    <TagChips
                      tags={activeGameCard.tags}
                      tagsMap={tagsMap}
                      maxVisible={18}
                    />
                  </div>
                ) : null}
              </div>

              <div className="gameSettingsInfoGrid dashboardGameInfoGrid">
                {activeGameInfoCards.map((infoCard) => (
                  <div
                    key={infoCard.label}
                    className="gameSettingsInfoCard dashboardGameInfoCard"
                  >
                    <div className="gameSettingsInfoLabel">{infoCard.label}</div>
                    <div className="gameSettingsInfoValue dashboardGameInfoValue">
                      {infoCard.value}
                    </div>
                  </div>
                ))}
              </div>

              <div className="swipeScreensPanel">
                <div className="swipeScreensPanelHeader">
                  <div className="swipeMediaSectionLabel">Скриншоты</div>
                  <div className="swipeScreensPanelMeta">
                    {activeGameScreens.length}
                  </div>
                </div>

                {activeGameScreens.length > 0 ? (
                  <div className="screensGrid dashboardGameScreensGrid">
                    {activeGameScreens.map((screenUrl, index) => (
                      <button
                        key={`${screenUrl}-${index}`}
                        className="dashboardGameScreenButton"
                        type="button"
                        onClick={() =>
                          onOpenImageViewer(activeGameScreens, index)
                        }
                      >
                        <img
                          className="screenImage"
                          src={screenUrl}
                          alt={`Скриншот ${index + 1}`}
                          loading="lazy"
                        />
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="downloadEmptyState">
                    {activeGameThreadItem
                      ? "Для этой игры скриншоты не пришли."
                      : "Полные метаданные и скриншоты появятся после синхронизации."}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {gameSettingsModalState && activeGameSettingsRecord ? (
        <div
          className="downloadModalOverlay"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target && !isGameSettingsBusy) {
              setGameSettingsModalState(null);
            }
          }}
        >
          <div className="downloadModal gameSettingsModal">
            <div className="downloadModalHeader">
              <div className="downloadModalTitleWrap gameSettingsTitleWrap">
                <div className="gameSettingsHero">
                  {gameSettingsModalState.coverUrl ? (
                    <img
                      className="gameSettingsHeroCover"
                      src={gameSettingsModalState.coverUrl}
                      alt="cover"
                    />
                  ) : (
                    <div className="gameSettingsHeroCover" />
                  )}
                  <div className="gameSettingsHeroText">
                    <div className="downloadModalTitle">
                      {gameSettingsModalState.threadTitle}
                    </div>
                    <div className="downloadModalMeta">
                      {gameSettingsModalState.threadLink}
                    </div>
                  </div>
                </div>
              </div>

              <div className="downloadModalActions">
                <button
                  className="button"
                  type="button"
                  onClick={() => setGameSettingsModalState(null)}
                  disabled={isGameSettingsBusy}
                >
                  Закрыть
                </button>
              </div>
            </div>

            <div className="downloadModalBody">
              <div className="gameSettingsInfoGrid">
                <div className="gameSettingsInfoCard">
                  <div className="gameSettingsInfoLabel">Статус</div>
                  <div className="gameSettingsInfoValue">
                    {formatLauncherStatus(activeGameSettingsRecord)}
                  </div>
                </div>
                <div className="gameSettingsInfoCard">
                  <div className="gameSettingsInfoLabel">Текущий запускатор</div>
                  <div className="gameSettingsInfoValue">
                    {activeGameSettingsRecord.launchTargetName ?? "Не выбран"}
                  </div>
                </div>
                <div className="gameSettingsInfoCard">
                  <div className="gameSettingsInfoLabel">Последний хост</div>
                  <div className="gameSettingsInfoValue">
                    {activeGameSettingsRecord.lastHostLabel ?? "Нет данных"}
                  </div>
                </div>
                <div className="gameSettingsInfoCard">
                  <div className="gameSettingsInfoLabel">Обновлено</div>
                  <div className="gameSettingsInfoValue">
                    {new Date(
                      activeGameSettingsRecord.updatedAtUnixMs,
                    ).toLocaleString()}
                  </div>
                </div>
              </div>

              <div className="gameSettingsPaths">
                <div className="gameSettingsPathCard">
                  <div className="gameSettingsInfoLabel">Папка игры</div>
                  <div className="gameSettingsPathValue">
                    {activeGameSettingsRecord.installDir ?? "Нет данных"}
                  </div>
                </div>
                <div className="gameSettingsPathCard">
                  <div className="gameSettingsInfoLabel">Архив</div>
                  <div className="gameSettingsPathValue">
                    {activeGameSettingsRecord.archivePath ?? "Нет данных"}
                  </div>
                </div>
                <div className="gameSettingsPathCard">
                  <div className="gameSettingsInfoLabel">Путь запускатора</div>
                  <div className="gameSettingsPathValue">
                    {activeGameSettingsRecord.launchTargetPath ?? "Не выбран"}
                  </div>
                </div>
                {activeGameSettingsRecord.errorMessage ? (
                  <div className="gameSettingsPathCard">
                    <div className="gameSettingsInfoLabel">Ошибка</div>
                    <div className="gameSettingsPathValue">
                      {activeGameSettingsRecord.errorMessage}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="gameSettingsActions">
                <button
                  className="button"
                  type="button"
                  disabled={
                    isGameSettingsBusy || !canRevealActiveGameSettingsRecord
                  }
                  onClick={() =>
                    runGameSettingsAction(() =>
                      onRevealInstalledGame(gameSettingsModalState.threadLink),
                    )
                  }
                >
                  Открыть папку
                </button>
                <button
                  className="button"
                  type="button"
                  disabled={isGameSettingsBusy}
                  onClick={() =>
                    runGameSettingsAction(() =>
                      onChooseInstallFolderForThread(
                        gameSettingsModalState.threadLink,
                        gameSettingsModalState.threadTitle,
                      ),
                    )
                  }
                >
                  Сменить папку игры
                </button>
                <button
                  className="button"
                  type="button"
                  disabled={
                    isGameSettingsBusy || !activeGameSettingsRecord.installDir
                  }
                  onClick={() =>
                    runGameSettingsAction(() =>
                      onChooseLaunchTargetForThread(
                        gameSettingsModalState.threadLink,
                      ),
                    )
                  }
                >
                  Выбрать запускатор
                </button>
                <button
                  className="button buttonDanger"
                  type="button"
                  disabled={isGameSettingsBusy}
                  onClick={() =>
                    runGameSettingsAction(() =>
                      onDeleteGameFilesForThread(
                        gameSettingsModalState.threadLink,
                        gameSettingsModalState.threadTitle,
                      ),
                    )
                  }
                >
                  Удалить файлы игры
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
