import { useMemo, useState } from "react";
import { TagChips } from "./TagChips";
import type { ListType, ProcessedThreadItem, SessionState } from "../f95/types";

type DashboardCard = {
  threadLink: string;
  coverUrl: string;
  title: string;
  creator: string;
  rating: number;
  tags: number[];
  addedAt: number;
  isPlayed: boolean;
  isInFavorites: boolean;
  isInTrash: boolean;
  listType: ListType | null;
  sectionKey: "favorite" | "trash" | "played";
};

type DashboardProps = {
  sessionState: SessionState;
  openBestDownloadForThread: (
    threadLink: string,
    threadTitle: string,
  ) => void | Promise<void>;
  tagsMap: Record<string, string>;
  openDownloadsForThread: (
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

const parseThreadIdentifierFromLink = (threadLink: string) => {
  const match = /\/threads\/(\d+)/.exec(threadLink);
  if (!match) {
    return null;
  }
  return Number(match[1]);
};

const normalizeText = (value: string) => value.trim().toLowerCase();

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

export const Dashboard = ({
  sessionState,
  openBestDownloadForThread,
  tagsMap,
  openDownloadsForThread,
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
  const [activeTab, setActiveTab] = useState<"bookmarks" | "trash" | "played">(
    "bookmarks",
  );
  const [sortField, setSortField] = useState<"addedAt" | "rating" | "title">(
    "addedAt",
  );
  const [sortDirection, setSortDirection] = useState<"desc" | "asc">("asc");
  const playedLinks = useMemo(
    () => sessionState.playedLinks,
    [sessionState.playedLinks],
  );

  const trackedLinks = useMemo(() => {
    const linkSet = new Set<string>();
    for (const link of sessionState.favoritesLinks) {
      linkSet.add(link);
    }
    for (const link of sessionState.trashLinks) {
      linkSet.add(link);
    }
    for (const link of playedLinks) {
      linkSet.add(link);
    }
    return Array.from(linkSet);
  }, [sessionState.favoritesLinks, sessionState.trashLinks, playedLinks]);

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
    () => normalizeText(searchText),
    [searchText],
  );

  const sortFieldLabel =
    sortField === "addedAt"
      ? "Дата добавления"
      : sortField === "rating"
        ? "Рейтинг"
        : "Название";

  const sortDirectionLabel =
    sortDirection === "desc" ? "По убыванию" : "По возрастанию";

  const searchAndSortSummary = searchText.trim()
    ? `Поиск: ${searchText.trim()} • ${sortFieldLabel}, ${sortDirectionLabel.toLowerCase()}`
    : `${sortFieldLabel}, ${sortDirectionLabel.toLowerCase()}`;

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

      const membershipListType: ListType | null =
        sessionState.favoritesLinks.includes(threadLink)
          ? "favorite"
          : sessionState.trashLinks.includes(threadLink)
            ? "trash"
            : playedLinks.includes(threadLink)
              ? "played"
              : null;

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
        tags: cardTags,
        addedAt:
          sessionState.processedThreadItemsByLink[threadLink]
            ?.addedAtUnixSeconds ?? 0,
        isPlayed: playedLinks.includes(threadLink),
        isInFavorites: sessionState.favoritesLinks.includes(threadLink),
        isInTrash: sessionState.trashLinks.includes(threadLink),
        listType: membershipListType,
        sectionKey,
      });
    }

    return sortCards(filteredCards, sortField, sortDirection);
  };

  const favoritesCards = useMemo(
    () => createCards(sessionState.favoritesLinks, "favorite"),
    [
      sessionState.favoritesLinks,
      sessionState.processedThreadItemsByLink,
      sessionState.threadItemsByIdentifier,
      playedLinks,
      sortField,
      sortDirection,
      normalizedSearchText,
      includeTagNumbers,
      excludeTagNumbers,
      pickCoverForLink,
      pickTitleForLink,
      pickCreatorForLink,
      pickRatingForLink,
    ],
  );

  const trashCards = useMemo(
    () => createCards(sessionState.trashLinks, "trash"),
    [
      sessionState.trashLinks,
      sessionState.processedThreadItemsByLink,
      sessionState.threadItemsByIdentifier,
      playedLinks,
      sortField,
      sortDirection,
      normalizedSearchText,
      includeTagNumbers,
      excludeTagNumbers,
      pickCoverForLink,
      pickTitleForLink,
      pickCreatorForLink,
      pickRatingForLink,
    ],
  );

  const playedCards = useMemo(
    () => createCards(playedLinks, "played"),
    [
      playedLinks,
      sessionState.processedThreadItemsByLink,
      sessionState.threadItemsByIdentifier,
      sortField,
      sortDirection,
      normalizedSearchText,
      includeTagNumbers,
      excludeTagNumbers,
      pickCoverForLink,
      pickTitleForLink,
      pickCreatorForLink,
      pickRatingForLink,
    ],
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
    { id: "bookmarks" as const, label: "Закладки", cards: favoritesCards },
    { id: "trash" as const, label: "Мусор", cards: trashCards },
    { id: "played" as const, label: "Играл", cards: playedCards },
  ];

  const activeTabItem =
    tabItems.find((item) => item.id === activeTab) ?? tabItems[0];

  const renderCardActions = (card: DashboardCard) => {
    const isInFavorites = card.isInFavorites;
    const isInTrash = card.isInTrash;
    const isPlayed = card.isPlayed;
    const quickActionCount =
      Number(!isPlayed) + Number(!isInFavorites) + Number(!isInTrash) + 1;

    const handleDangerClick = () => {
      if (card.sectionKey === "played") {
        removeLinkFromList(card.threadLink, "played");
        return;
      }
      removeLinkFromList(card.threadLink, card.sectionKey as ListType);
    };

    return (
      <div className="listItemActionsRow">
        <div className="listItemPrimaryActions">
          <button
            className="button listItemDownloadButton listItemBestDownloadButton"
            type="button"
            onClick={() => {
              void openBestDownloadForThread(card.threadLink, card.title);
            }}
          >
            Лучший
          </button>
          <button
            className="button listItemDownloadButton listItemAllDownloadsButton"
            type="button"
            onClick={() => {
              void openDownloadsForThread(card.threadLink, card.title);
            }}
          >
            Зеркала
          </button>
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

  const renderCardsList = (cards: DashboardCard[]) => {
    if (cards.length === 0) {
      return (
        <div className="statusBox dashboardEmptyState">
          <div style={{ fontWeight: 900, fontSize: 18 }}>
            В этом списке пока ничего нет
          </div>
          <div className="mutedText">
            Попробуй сменить вкладку или ослабить фильтры поиска и тегов.
          </div>
        </div>
      );
    }

    return (
      <div className="listGrid" style={{ marginTop: 12 }}>
        {cards.map((card) => (
          <div key={card.threadLink} className="listItemCard">
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
                />
              ) : (
                <div className="listItemCover" />
              )}
            </a>
            <div className="listItemBody">
              <div className="listItemTitle">{card.title}</div>
              <div className="listItemMeta">
                <span>{card.creator}</span>
                <span>Rating: {card.rating}</span>
              </div>
              <TagChips tags={card.tags} tagsMap={tagsMap} />
              {renderCardActions(card)}
            </div>
          </div>
        ))}
      </div>
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
          <div className="sectionMeta">{activeTabItem.cards.length} игр</div>
        </div>
        {renderCardsList(activeTabItem.cards)}
      </div>
    </div>
  );
};
