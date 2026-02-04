import { useMemo, useState } from "react";
import { CollapsibleSection } from "./CollapsibleSection";
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
  tagsMap: Record<string, string>;
  togglePlayedForLink: (link: string) => void;
  setPlayedFlagForLink: (link: string, value: boolean) => void;
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
  tagsMap,
  togglePlayedForLink,
  setPlayedFlagForLink,
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
  const [sortField, setSortField] = useState<"addedAt" | "rating" | "title">(
    "addedAt",
  );
  const [sortDirection, setSortDirection] = useState<"desc" | "asc">("desc");
  const [openSections, setOpenSections] = useState({
    bookmarks: true,
    trash: false,
    played: false,
  });
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

  const toggleSection = (sectionKey: keyof typeof openSections) => {
    setOpenSections((previous) => ({
      ...previous,
      [sectionKey]: !previous[sectionKey],
    }));
  };

  const scrollToSection = (sectionId: string) => {
    const targetElement = document.getElementById(sectionId);
    if (!targetElement) {
      return;
    }
    setOpenSections((previous) => ({
      ...previous,
      [sectionId]: true,
    }));
    targetElement.scrollIntoView({ behavior: "smooth", block: "start" });
  };

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
        isPlayed: Boolean(sessionState.playedByLink[threadLink]),
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
      sessionState.playedByLink,
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
      sessionState.playedByLink,
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
    () => createCards(playedLinks, "played", false),
    [
      playedLinks,
      sessionState.processedThreadItemsByLink,
      sessionState.threadItemsByIdentifier,
      sessionState.playedByLink,
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

  const navItems = [
    {
      id: "bookmarks",
      label: "К Закладкам",
      count: sessionState.favoritesLinks.length,
    },
    { id: "trash", label: "К Мусору", count: sessionState.trashLinks.length },
    { id: "played", label: "К Играл", count: playedLinks.length },
  ];

  const renderCardActions = (card: DashboardCard) => {
    const isInFavorites = card.isInFavorites;
    const isInTrash = card.isInTrash;
    const isPlayed = card.isPlayed;

    const handleDangerClick = () => {
      if (card.sectionKey === "played") {
        setPlayedFlagForLink(card.threadLink, false);
        return;
      }
      removeLinkFromList(card.threadLink, card.sectionKey as ListType);
    };

    return (
      <div className="listItemActionsRow">
        <div className="listItemActions">
          <button
            className={`iconButton iconButtonPlayed ${isPlayed ? "iconButtonActive" : ""}`}
            onClick={() => {
              togglePlayedForLink(card.threadLink);
            }}
            aria-pressed={isPlayed}
            aria-label={isPlayed ? "Снять отметку Играл" : "Отметить как Играл"}
          >
            <span aria-hidden>🎮</span>
            <span className="srOnly">
              {isPlayed ? "Снять отметку Играл" : "Отметить как Играл"}
            </span>
          </button>
          <button
            className={`iconButton iconButtonStar ${isInFavorites ? "iconButtonActive" : ""}`}
            onClick={() => {
              moveLinkToList(card.threadLink, "favorite");
            }}
            disabled={isInFavorites}
            aria-label={
              isInFavorites ? "Уже в избранном" : "Перенести в избранное"
            }
          >
            <span aria-hidden>★</span>
            <span className="srOnly">
              {isInFavorites ? "Уже в избранном" : "Перенести в избранное"}
            </span>
          </button>
          <button
            className={`iconButton iconButtonTrash ${isInTrash ? "iconButtonActive" : ""}`}
            onClick={() => {
              moveLinkToList(card.threadLink, "trash");
            }}
            disabled={isInTrash}
            aria-label={isInTrash ? "Уже в мусоре" : "Перенести в мусор"}
          >
            <span aria-hidden>🗑</span>
            <span className="srOnly">
              {isInTrash ? "Уже в мусоре" : "Перенести в мусор"}
            </span>
          </button>
        </div>
        <button
          className="iconButton iconButtonDanger listItemActionsDanger"
          onClick={handleDangerClick}
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
    );
  };
  return (
    <div className="dashboard">
      <div className="dashboardNav">
        {navItems.map((item) => (
          <button
            key={item.id}
            type="button"
            className="dashboardNavButton"
            onClick={() => scrollToSection(item.id)}
          >
            {item.label}
            <span className="pill">
              <strong>{item.count}</strong>
            </span>
          </button>
        ))}
      </div>

      <div className="dashboardFilters">
        <div className="formRow">
          <div className="label">Поиск по title / creator</div>
          <input
            className="input"
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder="например: team18"
          />
        </div>

        <div className="formRow" style={{ flexDirection: "row", gap: 8 }}>
          <div style={{ flex: 1 }}>
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
            className="button"
            type="button"
            onClick={toggleSortDirection}
          >
            {sortDirection === "desc" ? "По убыванию" : "По возрастанию"}
          </button>
        </div>

        <div className="tagFilterRow">
          <div>
            <div className="label">Include теги</div>
            <div className="tagFilterChips">
              {availableTagOptions.map((option) => (
                <button
                  key={`include-${option.id}`}
                  type="button"
                  className={`tagFilterChip ${
                    includeTags.includes(option.id) ? "tagFilterChipActive" : ""
                  }`}
                  onClick={() => toggleIncludeTag(option.id)}
                >
                  {option.label}
                </button>
              ))}
              {!availableTagOptions.length ? (
                <span className="smallText">Нет меток</span>
              ) : null}
            </div>
          </div>
          <div>
            <div className="label">Exclude теги</div>
            <div className="tagFilterChips">
              {availableTagOptions.map((option) => (
                <button
                  key={`exclude-${option.id}`}
                  type="button"
                  className={`tagFilterChip ${
                    excludeTags.includes(option.id) ? "tagFilterChipActive" : ""
                  }`}
                  onClick={() => toggleExcludeTag(option.id)}
                >
                  {option.label}
                </button>
              ))}
              {!availableTagOptions.length ? (
                <span className="smallText">Нет меток</span>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <CollapsibleSection
        id="bookmarks"
        title="Закладки"
        count={favoritesCards.length}
        isOpen={openSections.bookmarks}
        onToggle={() => toggleSection("bookmarks")}
      >
        <div className="listGrid" style={{ marginTop: 12 }}>
          {favoritesCards.map((card) => (
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
      </CollapsibleSection>

      <CollapsibleSection
        id="trash"
        title="Мусор"
        count={trashCards.length}
        isOpen={openSections.trash}
        onToggle={() => toggleSection("trash")}
      >
        <div className="listGrid" style={{ marginTop: 12 }}>
          {trashCards.map((card) => (
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
      </CollapsibleSection>

      <CollapsibleSection
        id="played"
        title="Играл"
        count={playedCards.length}
        isOpen={openSections.played}
        onToggle={() => toggleSection("played")}
        defaultOpen={false}
      >
        <div className="listGrid" style={{ marginTop: 12 }}>
          {playedCards.map((card) => (
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
      </CollapsibleSection>
    </div>
  );
};
