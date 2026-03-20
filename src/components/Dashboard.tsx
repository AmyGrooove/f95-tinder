import { useDeferredValue, useEffect, useMemo, useState } from "react";
import type { MouseEvent } from "react";
import type { ListType, ProcessedThreadItem, SessionState } from "../f95/types";
import {
  countUpdatedTrackedItems,
  hasProcessedThreadItemUpdate,
} from "../f95/updateTracking";
import {
  getLauncherPrimaryActionLabel,
  isLauncherGameBusy,
} from "../launcher/ui";
import type { LauncherGameRecord } from "../launcher/types";

type DashboardCard = {
  threadLink: string;
  coverUrl: string;
  title: string;
  creator: string;
  rating: number;
  version: string;
  isUpdated: boolean;
  tags: number[];
  addedAt: number;
  isPlayed: boolean;
  isInFavorites: boolean;
  isInTrash: boolean;
  listType: ListType | null;
  sectionKey: "favorite" | "trash" | "played";
};

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
  tagsMap: Record<string, string>;
  onRevealInstalledGame: (threadLink: string) => void | Promise<void>;
  onDeleteGameFilesForThread: (
    threadLink: string,
    threadTitle: string,
  ) => void | Promise<void>;
  onChooseLaunchTargetForThread: (threadLink: string) => void | Promise<void>;
  onOpenErrorMirrorForThread: (
    threadLink: string,
    threadTitle: string,
  ) => void | Promise<void>;
  moveLinkToList: (link: string, listType: ListType) => void;
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
  sortField: "addedAt" | "rating" | "title",
  sortDirection: "desc" | "asc",
) => {
  const multiplier = sortDirection === "desc" ? -1 : 1;
  return [...cards].sort((first, second) => {
    let comparison = 0;
    if (sortField === "addedAt") {
      comparison = first.addedAt - second.addedAt;
    } else if (sortField === "rating") {
      comparison = first.rating - second.rating;
    } else {
      comparison = first.title.localeCompare(second.title);
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

export const Dashboard = ({
  sessionState,
  isLauncherAvailable,
  launcherGamesByThreadLink,
  openBestDownloadForThread,
  tagsMap,
  onRevealInstalledGame,
  onDeleteGameFilesForThread,
  onChooseLaunchTargetForThread,
  onOpenErrorMirrorForThread,
  moveLinkToList,
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
  const [sortField, setSortField] = useState<"addedAt" | "rating" | "title">(
    "addedAt",
  );
  const [sortDirection, setSortDirection] = useState<"desc" | "asc">("asc");
  const [visibleCardCountByTab, setVisibleCardCountByTab] = useState(
    createInitialVisibleCardCounts,
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

  useEffect(() => {
    setVisibleCardCountByTab(createInitialVisibleCardCounts());
  }, [
    normalizedSearchText,
    includeTagNumbers,
    excludeTagNumbers,
    onlyUpdatedTracked,
    sortField,
    sortDirection,
  ]);

  const sortFieldLabel =
    sortField === "addedAt"
      ? "Дата добавления"
      : sortField === "rating"
        ? "Рейтинг"
        : "Название";

  const sortDirectionLabel =
    sortDirection === "desc" ? "По убыванию" : "По возрастанию";

  const searchAndSortSummary = [
    searchText.trim() ? `Поиск: ${searchText.trim()}` : null,
    `${sortFieldLabel}, ${sortDirectionLabel.toLowerCase()}`,
    onlyUpdatedTracked ? "только обновленные" : null,
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

      const membershipListType: ListType | null =
        favoritesLinkSet.has(threadLink)
          ? "favorite"
          : trashLinkSet.has(threadLink)
            ? "trash"
            : playedLinkSet.has(threadLink)
              ? "played"
              : null;
      const threadIdentifier = parseThreadIdentifierFromLink(threadLink);
      const threadItem =
        threadIdentifier !== null
          ? sessionState.threadItemsByIdentifier[String(threadIdentifier)]
          : null;
      const version =
        processedItem?.version?.trim() ||
        (typeof threadItem?.version === "string" ? threadItem.version : "");

      filteredCards.push({
        threadLink,
        coverUrl: pickCoverForLink(
          threadLink,
          sessionState.processedThreadItemsByLink,
          sessionState.threadItemsByIdentifier,
        ),
        title,
        creator,
        rating: pickRatingForLink(
          threadLink,
          sessionState.processedThreadItemsByLink,
          sessionState.threadItemsByIdentifier,
        ),
        version,
        isUpdated,
        tags: cardTags,
        addedAt: processedItem?.addedAtUnixSeconds ?? 0,
        isPlayed: playedLinkSet.has(threadLink),
        isInFavorites: favoritesLinkSet.has(threadLink),
        isInTrash: trashLinkSet.has(threadLink),
        listType: membershipListType,
        sectionKey,
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

  const activeGameSettingsRecord = useMemo(() => {
    if (!gameSettingsModalState) {
      return null;
    }

    return launcherGamesByThreadLink[gameSettingsModalState.threadLink] ?? null;
  }, [gameSettingsModalState, launcherGamesByThreadLink]);

  useEffect(() => {
    if (
      gameSettingsModalState &&
      !launcherGamesByThreadLink[gameSettingsModalState.threadLink]
    ) {
      setGameSettingsModalState(null);
      setIsGameSettingsBusy(false);
    }
  }, [gameSettingsModalState, launcherGamesByThreadLink]);

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
    const launcherGame = launcherGamesByThreadLink[card.threadLink] ?? null;
    const canRevealInstalledGame =
      isLauncherAvailable && launcherGame?.status === "installed";
    const isInstalled = launcherGame?.status === "installed";
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
    const quickActionCount =
      Number(!isPlayed) + Number(!isInFavorites) + Number(!isInTrash) + 1;

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
          className={`listItemPrimaryActions ${
            canRevealInstalledGame
              ? "listItemPrimaryActionsInstalled"
              : isError
                ? "listItemPrimaryActionsWithHint"
                : "listItemPrimaryActionsSingle"
          }`}
        >
          <button
            className={`button listItemDownloadButton listItemBestDownloadButton ${
              isInstalled ? "listItemPlayButton" : ""
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
          {canRevealInstalledGame ? (
            <button
              className="button listItemDownloadButton listItemSettingsButton"
              type="button"
              title="Настройки игры"
              aria-label="Настройки игры"
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
          ) : errorHint ? (
            <button
              className="button listItemStatusHintButton"
              type="button"
              title={errorHintLabel ?? undefined}
              aria-label={errorHintLabel ?? undefined}
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
          {!isInFavorites ? (
            <button
              className="iconButton listItemActionIconButton iconButtonStar"
              onClick={() => {
                moveLinkToList(card.threadLink, "favorite");
              }}
              title="Перенести в избранное"
              aria-label="Перенести в избранное"
            >
              <span aria-hidden>★</span>
              <span className="srOnly">Перенести в избранное</span>
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
            {onlyUpdatedTracked && tabId !== "trash"
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
          {cards.map((card) => (
            <div
              key={card.threadLink}
              className={`listItemCard ${
                card.isUpdated ? "listItemCardUpdated" : ""
              }`}
            >
              <a
                className="listItemCoverLink"
                href={card.threadLink}
                target="_blank"
                rel="noopener noreferrer"
              >
                {card.coverUrl ? (
                  <img
                    className="listItemCover"
                    src={card.coverUrl}
                    alt="cover"
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <div className="listItemCover" />
                )}
              </a>
              <div className="listItemBody">
                <div className="listItemContent">
                  <div className="listItemTitleRow">
                    <div className="listItemTitle" title={card.title}>
                      {card.title}
                    </div>
                  </div>
                </div>
                {renderCardActions(card)}
              </div>
            </div>
          ))}
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
                    onChange={(event) =>
                      setSortField(
                        event.target.value as "addedAt" | "rating" | "title",
                      )
                    }
                  >
                    <option value="addedAt">По дате добавления</option>
                    <option value="rating">По рейтингу</option>
                    <option value="title">По названию</option>
                  </select>
                </div>
                <button
                  className="button dashboardSortDirectionButton"
                  type="button"
                  onClick={toggleSortDirection}
                >
                  {sortDirectionLabel}
                </button>
              </div>

              <label className="checkboxRow">
                <input
                  type="checkbox"
                  checked={onlyUpdatedTracked}
                  onChange={(event) =>
                    setOnlyUpdatedTracked(event.target.checked)
                  }
                />
                Только обновленные в закладках и Играл
              </label>

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
          <div className="sectionMeta">
            {activeCards.length} игр
            {activeTabItem.updatedCount > 0 &&
            activeTabItem.id !== "trash"
              ? ` • обновились ${activeTabItem.updatedCount}`
              : ""}
          </div>
        </div>
        {renderCardsList(visibleCards, activeCards.length, activeTabItem.id)}
      </div>

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
                  disabled={isGameSettingsBusy}
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
