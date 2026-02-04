import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useF95Browser } from "./f95/useF95Browser";
import { buildThreadLink } from "./f95/api";
import { downloadJsonFile, readFileAsText, safeJsonParse } from "./f95/utils";
import { normalizeSessionState, normalizeTagsMap, saveSessionState, saveTagsMap } from "./f95/storage";
import type { ProcessedThreadItem } from "./f95/types";
import { Dashboard } from "./components/Dashboard";
import { SyncMetadataPanel } from "./components/SyncMetadataPanel";
import { TagChips } from "./components/TagChips";

const openLinkInNewTab = (link: string) => {
  window.open(link, "_blank", "noopener,noreferrer");
};

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

type PageType = "swipe" | "dashboard";

const readPageFromHash = (): PageType => {
  const hashValue = window.location.hash.replace("#", "").trim().toLowerCase();
  return hashValue === "dashboard" ? "dashboard" : "swipe";
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
    togglePlayedForLink,
    setPlayedFlagForLink,
    moveLinkToList,
    removeLinkFromList,
  } = useF95Browser();

  const [viewerState, setViewerState] = useState<ViewerState>(() =>
    createClosedViewerState(),
  );
  const [pageType, setPageType] = useState<PageType>(() => readPageFromHash());
  const [areBookmarkTagsVisible, setAreBookmarkTagsVisible] = useState(false);
  const [areTrashTagsVisible, setAreTrashTagsVisible] = useState(false);
  const [arePlayedTagsVisible, setArePlayedTagsVisible] = useState(false);

  const importSessionStateInputRef = useRef<HTMLInputElement | null>(null);
  const importTagsMapInputRef = useRef<HTMLInputElement | null>(null);

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

  const progressPills = useMemo(() => {
    return [
      { label: "Страница", value: sessionState.currentPageNumber },
      {
        label: "В очереди",
        value: sessionState.remainingThreadIdentifiers.length,
      },
      { label: "Просмотрено", value: sessionState.viewedCount },
      { label: "Избранное", value: sessionState.favoritesLinks.length },
      { label: "Мусор", value: sessionState.trashLinks.length },
      { label: "Играл", value: playedCount },
    ];
  }, [sessionState, playedCount]);

  const handleFavorite = useCallback(() => {
    applyActionToCurrentCard("favorite");
  }, [applyActionToCurrentCard]);

  const handleTrash = useCallback(() => {
    applyActionToCurrentCard("trash");
  }, [applyActionToCurrentCard]);

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

  const openViewer = useCallback(
    (imageUrlList: string[], startIndex: number) => {
      setViewerState({ isOpen: true, imageUrlList, activeIndex: startIndex });
    },
    [],
  );

  const closeViewer = useCallback(() => {
    setViewerState(createClosedViewerState());
  }, []);

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

  const setPage = useCallback((nextPageType: PageType) => {
    setPageType(nextPageType);
    window.location.hash =
      nextPageType === "dashboard" ? "#dashboard" : "#swipe";
  }, []);

  useEffect(() => {
    const handleHashChange = () => {
      setPageType(readPageFromHash());
    };

    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
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
    closeViewer,
    currentThreadLink,
    handleFavorite,
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

  const isCurrentThreadPlayed = useMemo(() => {
    if (!currentThreadLink) {
      return false;
    }
    return Boolean(sessionState.playedByLink[currentThreadLink]);
  }, [currentThreadLink, sessionState.playedByLink]);

  const currentThreadTags = useMemo(() => {
    if (!currentThreadLink) {
      return [];
    }
    return getTagsForLink(currentThreadLink);
  }, [currentThreadLink, getTagsForLink]);
  const formatTagLabel = useCallback(
    (tagId: number) => tagsMap[String(tagId)] ?? `#${tagId}`,
    [tagsMap],
  );

  const buildTagStats = useCallback(
    (links: string[]) => {
      const countByTag = new Map<number, number>();

      for (const threadLink of links) {
        const tags = getTagsForLink(threadLink);
        for (const tagId of tags) {
          if (typeof tagId !== "number") {
            continue;
          }
          countByTag.set(tagId, (countByTag.get(tagId) ?? 0) + 1);
        }
      }

      return Array.from(countByTag.entries())
        .sort((first, second) => second[1] - first[1])
        .slice(0, 12)
        .map(([tagId, count]) => ({
          tagId,
          label: formatTagLabel(tagId),
          count,
        }));
    },
    [formatTagLabel, getTagsForLink],
  );

  const tagStatsFavorites = useMemo(
    () => buildTagStats(sessionState.favoritesLinks),
    [buildTagStats, sessionState.favoritesLinks],
  );

  const tagStatsTrash = useMemo(
    () => buildTagStats(sessionState.trashLinks),
    [buildTagStats, sessionState.trashLinks],
  );

  const tagStatsPlayed = useMemo(
    () => buildTagStats(playedLinks),
    [buildTagStats, playedLinks],
  );

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

  const swipeView = (
    <div className="mainGrid">
      <div className="panel">
        <h3 className="panelTitle">Фильтры</h3>

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
          Хоткеи: Left - мусор, Right - избранное, Enter - открыть, Backspace/Z
          - undo
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
                  className="button"
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
              <button className="button buttonDanger" onClick={handleTrash}>
                В мусор (Left)
              </button>
              <button
                className="button"
                onClick={() =>
                  currentThreadLink && togglePlayedForLink(currentThreadLink)
                }
              >
                {isCurrentThreadPlayed ? "Снять Играл" : "Играл"}
              </button>
              <button className="button buttonPrimary" onClick={handleFavorite}>
                В избранное (Right)
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const renderTagSection = (
    title: string,
    countLabel: string,
    countValue: number,
    stats: Array<{ tagId: number; label: string; count: number }>,
    isVisible: boolean,
    toggleVisibility: () => void,
  ) => (
    <div style={{ marginTop: 12 }}>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
          gap: 8,
          alignItems: "center",
        }}
      >
        <div>
          <div className="label">{title}</div>
          <div className="smallText" style={{ marginTop: 6 }}>
            {countLabel}: <strong>{countValue}</strong>
          </div>
        </div>
        <button className="button" type="button" onClick={toggleVisibility}>
          {isVisible
            ? "Скрыть популярные теги"
            : "Показать популярные теги"}
        </button>
      </div>
      {isVisible ? (
        <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
          {stats.length === 0 ? (
            <div className="smallText">Пока нет тегов</div>
          ) : (
            stats.map((tagStat) => (
              <div
                key={`${title}-${tagStat.tagId}`}
                className="pill"
                style={{ justifyContent: "space-between" }}
              >
                <span>{tagStat.label}</span>
                <strong>{tagStat.count}</strong>
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  );

  const dashboardView = (
    <div className="mainGrid">
      <div className="panel">
        <h3 className="panelTitle">Дашборд</h3>
        <div className="smallText">
          Здесь видно статистику и все игры в списках. В карточках можно открыть
          тред.
        </div>

        {renderTagSection(
          "Закладки",
          "В закладках",
          sessionState.favoritesLinks.length,
          tagStatsFavorites,
          areBookmarkTagsVisible,
          () => setAreBookmarkTagsVisible((prev) => !prev),
        )}
        {renderTagSection(
          "Мусор",
          "В мусоре",
          sessionState.trashLinks.length,
          tagStatsTrash,
          areTrashTagsVisible,
          () => setAreTrashTagsVisible((prev) => !prev),
        )}
        {renderTagSection(
          "Играл",
          "Отмечено",
          playedCount,
          tagStatsPlayed,
          arePlayedTagsVisible,
          () => setArePlayedTagsVisible((prev) => !prev),
        )}

        <div className="smallText" style={{ marginTop: 12 }}>
          Подсказка: если какие-то игры импортированы без данных, они покажутся
          без обложки. Новые свайпы сохраняют title/creator/cover.
        </div>

        <div style={{ marginTop: 12 }}>
          <div className="label">Импорт тегов</div>
          <button
            className="button"
            type="button"
            onClick={() => importTagsMapInputRef.current?.click()}
          >
            Импорт tagsMap.json
          </button>
          <input
            ref={importTagsMapInputRef}
            type="file"
            accept="application/json"
            hidden
            onChange={handleImportTagsMapChange}
          />
          <div className="smallText" style={{ marginTop: 6 }}>
            Формат: {`{ "45": "3D", "130": "RenPy" }`}
          </div>
        </div>

        <SyncMetadataPanel
          metadataSyncState={metadataSyncState}
          startMetadataSync={startMetadataSync}
        />
      </div>

      <div className="dashboardGrid">
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
          </div>
          <div className="metricCard">
            <div className="metricLabel">Мусор</div>
            <div className="metricValue">{sessionState.trashLinks.length}</div>
          </div>
          <div className="metricCard">
            <div className="metricLabel">Играл</div>
            <div className="metricValue">{playedCount}</div>
          </div>
          <div className="metricCard">
            <div className="metricLabel">В очереди</div>
            <div className="metricValue">
              {sessionState.remainingThreadIdentifiers.length}
            </div>
          </div>
        </div>

        <Dashboard
          sessionState={sessionState}
          tagsMap={tagsMap}
          togglePlayedForLink={togglePlayedForLink}
          setPlayedFlagForLink={setPlayedFlagForLink}
          moveLinkToList={moveLinkToList}
          removeLinkFromList={removeLinkFromList}
          pickCoverForLink={pickCoverForLink}
          pickTitleForLink={pickTitleForLink}
          pickCreatorForLink={pickCreatorForLink}
          pickRatingForLink={pickRatingForLink}
        />
      </div>
    </div>
  );

  return (
    <div className="appRoot">
      <div className="topBar">
        <div className="topBarGrid">
          <div className="progressText">
            {progressPills.map((pill) => (
              <span key={pill.label} className="pill">
                {pill.label}: <strong>{pill.value}</strong>
              </span>
            ))}
          </div>

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
              className="button"
              onClick={undoLastAction}
              disabled={!canUndo || pageType !== "swipe"}
            >
              Undo
            </button>

              <button
                className="button"
                onClick={handleExportSessionState}
              >
                Экспортировать
              </button>

              <button
                className="button"
                onClick={() => importSessionStateInputRef.current?.click()}
              >
                Импорт
              </button>
              <input
                ref={importSessionStateInputRef}
                type="file"
                accept="application/json"
                hidden
                onChange={handleImportSessionStateChange}
              />

            <button
              className="button buttonDanger"
              onClick={() => {
                const shouldClear = window.confirm(
                  "Удалить все локальные данные (сессия + кэш страниц)?",
                );
                if (shouldClear) {
                  clearAllData();
                }
              }}
            >
              Очистить
            </button>
          </div>
        </div>

        {errorMessage ? (
          <div className="smallText" style={{ marginTop: 8 }}>
            {errorMessage}
          </div>
        ) : null}
      </div>

      {pageType === "dashboard" ? dashboardView : swipeView}

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
