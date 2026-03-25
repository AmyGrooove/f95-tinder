import { useMemo } from "react";
import { getEnginePrefixIdList } from "../f95/prefixes";
import {
  countUpdatedTrackedItems,
  getProcessedThreadItemUpdateLabel,
  hasProcessedThreadItemUpdate,
} from "../f95/updateTracking";
import type { ListType, ProcessedThreadItem, SessionState } from "../f95/types";

type DashboardOverviewProps = {
  sessionState: SessionState;
  tagsMap: Record<string, string>;
  prefixesMap: Record<string, string>;
};

type TrackedStatsItem = {
  threadLink: string;
  title: string;
  creator: string;
  rating: number;
  views: number;
  likes: number;
  addedAt: number;
  listType: ListType;
  isPlayedFavorite: boolean;
  isUpdated: boolean;
  updateLabel: string | null;
  tags: number[];
};

type TopCountItem = {
  label: string;
  count: number;
};

type ListSummary = {
  id: ListType;
  label: string;
  count: number;
  shareLabel: string;
  averageRatingLabel: string;
  updatedCount: number;
  topTagLabel: string | null;
  topEngineLabel: string | null;
};

const listLabelByType: Record<ListType, string> = {
  favorite: "Закладки",
  trash: "Мусор",
  played: "Играл",
};

const compactNumberFormatter = new Intl.NumberFormat("ru-RU", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const averageNumberFormatter = new Intl.NumberFormat("ru-RU", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const dateTimeFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const parseThreadIdentifierFromLink = (threadLink: string) => {
  const match = /\/threads\/(\d+)/.exec(threadLink);
  if (!match) {
    return null;
  }
  return Number(match[1]);
};

const formatCompactNumber = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) {
    return "0";
  }

  return compactNumberFormatter.format(value);
};

const formatAverageRating = (sum: number, count: number) => {
  if (count === 0) {
    return "0.0";
  }

  return averageNumberFormatter.format(sum / count);
};

const formatShareLabel = (count: number, total: number) => {
  if (total <= 0) {
    return "0%";
  }

  const share = (count / total) * 100;
  const roundedShare = share >= 10 ? Math.round(share) : Math.round(share * 10) / 10;
  return `${String(roundedShare).replace(".", ",")}%`;
};

const formatDateTimeLabelFromSeconds = (unixSeconds: number | null | undefined) => {
  if (
    typeof unixSeconds !== "number" ||
    !Number.isFinite(unixSeconds) ||
    unixSeconds <= 0
  ) {
    return "Не указана";
  }

  return dateTimeFormatter.format(new Date(unixSeconds * 1000));
};

const formatDateTimeLabelFromMs = (unixMs: number | null | undefined) => {
  if (typeof unixMs !== "number" || !Number.isFinite(unixMs) || unixMs <= 0) {
    return "Еще не запускалась";
  }

  return dateTimeFormatter.format(new Date(unixMs));
};

const pickTopCountItems = (counter: Map<string, number>, limit = 6): TopCountItem[] => {
  return Array.from(counter.entries())
    .map(([label, count]) => ({
      label,
      count,
    }))
    .sort((first, second) => {
      if (second.count !== first.count) {
        return second.count - first.count;
      }
      return first.label.localeCompare(second.label);
    })
    .slice(0, limit);
};

const incrementCounter = (counter: Map<string, number>, label: string | null | undefined) => {
  if (!label) {
    return;
  }

  counter.set(label, (counter.get(label) ?? 0) + 1);
};

const resolveTitle = (
  processedItem: ProcessedThreadItem | null | undefined,
  threadItem: { title?: string } | null | undefined,
  threadLink: string,
) => {
  if (typeof processedItem?.title === "string" && processedItem.title.trim()) {
    return processedItem.title.trim();
  }
  if (typeof threadItem?.title === "string" && threadItem.title.trim()) {
    return threadItem.title.trim();
  }
  return threadLink;
};

const resolveCreator = (
  processedItem: ProcessedThreadItem | null | undefined,
  threadItem: { creator?: string } | null | undefined,
) => {
  if (typeof processedItem?.creator === "string" && processedItem.creator.trim()) {
    return processedItem.creator.trim();
  }
  if (typeof threadItem?.creator === "string" && threadItem.creator.trim()) {
    return threadItem.creator.trim();
  }
  return "Не указан";
};

const resolveRating = (
  processedItem: ProcessedThreadItem | null | undefined,
  threadItem: { rating?: number } | null | undefined,
) => {
  if (typeof threadItem?.rating === "number" && Number.isFinite(threadItem.rating)) {
    return threadItem.rating;
  }
  if (typeof processedItem?.rating === "number" && Number.isFinite(processedItem.rating)) {
    return processedItem.rating;
  }
  return 0;
};

const resolveNumberList = (
  primary: number[] | undefined,
  fallback: number[] | undefined,
) => {
  if (Array.isArray(primary) && primary.length > 0) {
    return primary;
  }
  if (Array.isArray(fallback) && fallback.length > 0) {
    return fallback;
  }
  return [];
};

const renderCountPills = (items: TopCountItem[]) => {
  return items.length === 0 ? (
    <div className="smallText">Пока нет данных</div>
  ) : (
    <div className="dashboardOverviewPillList">
      {items.map((item) => (
        <span key={item.label} className="dashboardOverviewPill">
          <span>{item.label}</span>
          <strong>{item.count}</strong>
        </span>
      ))}
    </div>
  );
};

export const DashboardOverview = ({
  sessionState,
  tagsMap,
  prefixesMap,
}: DashboardOverviewProps) => {
  const summary = useMemo(() => {
    const favoriteLinkSet = new Set(sessionState.favoritesLinks);
    const trashLinkSet = new Set(sessionState.trashLinks);
    const playedFavoriteLinkSet = new Set(sessionState.playedFavoriteLinks);
    const trackedLinks = Array.from(
      new Set([
        ...sessionState.favoritesLinks,
        ...sessionState.trashLinks,
        ...sessionState.playedLinks,
      ]),
    );

    const tagCounts = new Map<string, number>();
    const engineCounts = new Map<string, number>();
    const creatorCounts = new Map<string, number>();
    const listBuckets = {
      favorite: {
        count: 0,
        updatedCount: 0,
        ratingSum: 0,
        ratedCount: 0,
        tagCounts: new Map<string, number>(),
        engineCounts: new Map<string, number>(),
      },
      trash: {
        count: 0,
        updatedCount: 0,
        ratingSum: 0,
        ratedCount: 0,
        tagCounts: new Map<string, number>(),
        engineCounts: new Map<string, number>(),
      },
      played: {
        count: 0,
        updatedCount: 0,
        ratingSum: 0,
        ratedCount: 0,
        tagCounts: new Map<string, number>(),
        engineCounts: new Map<string, number>(),
      },
    };

    const trackedItems: TrackedStatsItem[] = [];
    let totalRatingSum = 0;
    let totalRatedCount = 0;
    let totalLikes = 0;
    let totalViews = 0;
    let latestAddedAt = 0;

    for (const threadLink of trackedLinks) {
      const listType = favoriteLinkSet.has(threadLink)
        ? "favorite"
        : trashLinkSet.has(threadLink)
          ? "trash"
          : "played";
      const threadIdentifier = parseThreadIdentifierFromLink(threadLink);
      const threadItem =
        threadIdentifier !== null
          ? sessionState.threadItemsByIdentifier[String(threadIdentifier)] ?? null
          : null;
      const processedItem = sessionState.processedThreadItemsByLink[threadLink] ?? null;
      const tags = resolveNumberList(threadItem?.tags, processedItem?.tags);
      const enginePrefixIds = getEnginePrefixIdList(
        resolveNumberList(threadItem?.prefixes, processedItem?.prefixes),
      );
      const rating = resolveRating(processedItem, threadItem);
      const creator = resolveCreator(processedItem, threadItem);
      const addedAt = processedItem?.addedAtUnixSeconds ?? 0;
      const isUpdated = hasProcessedThreadItemUpdate(processedItem);
      const item: TrackedStatsItem = {
        threadLink,
        title: resolveTitle(processedItem, threadItem, threadLink),
        creator,
        rating,
        views:
          typeof threadItem?.views === "number" && Number.isFinite(threadItem.views)
            ? threadItem.views
            : 0,
        likes:
          typeof threadItem?.likes === "number" && Number.isFinite(threadItem.likes)
            ? threadItem.likes
            : 0,
        addedAt,
        listType,
        isPlayedFavorite: playedFavoriteLinkSet.has(threadLink),
        isUpdated,
        updateLabel: getProcessedThreadItemUpdateLabel(processedItem),
        tags,
      };

      trackedItems.push(item);
      latestAddedAt = Math.max(latestAddedAt, addedAt);
      totalLikes += item.likes;
      totalViews += item.views;

      if (item.rating > 0) {
        totalRatingSum += item.rating;
        totalRatedCount += 1;
      }

      incrementCounter(creatorCounts, creator);

      for (const tagValue of new Set(item.tags)) {
        const label = tagsMap[String(tagValue)] ?? `#${tagValue}`;
        incrementCounter(tagCounts, label);
        incrementCounter(listBuckets[listType].tagCounts, label);
      }

      for (const prefixId of enginePrefixIds) {
        const label = prefixesMap[String(prefixId)] ?? `#${prefixId}`;
        incrementCounter(engineCounts, label);
        incrementCounter(listBuckets[listType].engineCounts, label);
      }

      const listBucket = listBuckets[listType];
      listBucket.count += 1;
      if (item.isUpdated) {
        listBucket.updatedCount += 1;
      }
      if (item.rating > 0) {
        listBucket.ratingSum += item.rating;
        listBucket.ratedCount += 1;
      }
    }

    const totalTrackedCount = trackedItems.length;
    const updatedCount = countUpdatedTrackedItems(
      trackedLinks,
      sessionState.processedThreadItemsByLink,
    );
    const listSummary: ListSummary[] = (["favorite", "trash", "played"] as const).map(
      (listType) => {
        const bucket = listBuckets[listType];
        const topTagLabel = pickTopCountItems(bucket.tagCounts, 1)[0]?.label ?? null;
        const topEngineLabel =
          pickTopCountItems(bucket.engineCounts, 1)[0]?.label ?? null;

        return {
          id: listType,
          label: listLabelByType[listType],
          count: bucket.count,
          shareLabel: formatShareLabel(bucket.count, totalTrackedCount),
          averageRatingLabel: formatAverageRating(bucket.ratingSum, bucket.ratedCount),
          updatedCount: bucket.updatedCount,
          topTagLabel,
          topEngineLabel,
        };
      },
    );

    return {
      totalTrackedCount,
      bookmarkCount: sessionState.favoritesLinks.length,
      trashCount: sessionState.trashLinks.length,
      playedCount: sessionState.playedLinks.length,
      playedFavoriteCount: sessionState.playedFavoriteLinks.length,
      updatedCount,
      averageRatingLabel: formatAverageRating(totalRatingSum, totalRatedCount),
      totalLikesLabel: formatCompactNumber(totalLikes),
      totalViewsLabel: formatCompactNumber(totalViews),
      uniqueCreatorCount: creatorCounts.size,
      uniqueTagCount: tagCounts.size,
      uniqueEngineCount: engineCounts.size,
      lastAddedLabel: formatDateTimeLabelFromSeconds(latestAddedAt),
      lastMetadataSyncLabel: formatDateTimeLabelFromMs(
        sessionState.lastMetadataSyncAtUnixMs,
      ),
      listSummary,
      topTags: pickTopCountItems(tagCounts),
      topEngines: pickTopCountItems(engineCounts),
      topCreators: pickTopCountItems(creatorCounts),
      recentItems: [...trackedItems]
        .sort((first, second) => second.addedAt - first.addedAt)
        .slice(0, 6),
      updatedItems: trackedItems
        .filter((item) => item.isUpdated)
        .sort((first, second) => second.addedAt - first.addedAt)
        .slice(0, 6),
    };
  }, [
    prefixesMap,
    sessionState.favoritesLinks,
    sessionState.lastMetadataSyncAtUnixMs,
    sessionState.playedFavoriteLinks,
    sessionState.playedLinks,
    sessionState.processedThreadItemsByLink,
    sessionState.threadItemsByIdentifier,
    sessionState.trashLinks,
    tagsMap,
  ]);

  if (summary.totalTrackedCount === 0) {
    return (
      <div className="dashboardOverview">
        <div className="panel">
          <div className="sectionTitleRow">
            <div>
              <h3 className="panelTitle dashboardPanelTitle">Дашборд</h3>
              <div className="smallText">
                Общая статистика по Закладкам, Мусору и Играл.
              </div>
            </div>
            <div className="sectionMeta">
              Последняя синхронизация: {summary.lastMetadataSyncLabel}
            </div>
          </div>
          <div className="statusBox" style={{ marginTop: 12 }}>
            <div style={{ fontWeight: 900, fontSize: 18 }}>
              В списках пока ничего нет
            </div>
            <div className="mutedText">
              Добавь игры в `Закладки`, `Мусор` или `Играл`, и здесь появится
              сводная статистика.
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboardOverview">
      <div className="panel">
        <div className="sectionTitleRow">
          <div>
            <h3 className="panelTitle dashboardPanelTitle">Дашборд</h3>
            <div className="smallText">
              Общая статистика по Закладкам, Мусору и Играл.
            </div>
          </div>
          <div className="sectionMeta">
            Последняя синхронизация: {summary.lastMetadataSyncLabel}
          </div>
        </div>

        <div className="dashboardCardsRow dashboardOverviewCardsRow">
          <div className="metricCard">
            <div className="metricLabel">Всего в списках</div>
            <div className="metricValue">{summary.totalTrackedCount}</div>
            <div className="smallText dashboardOverviewMetricMeta">
              Последнее добавление: {summary.lastAddedLabel}
            </div>
          </div>
          <div className="metricCard">
            <div className="metricLabel">Закладки</div>
            <div className="metricValue">{summary.bookmarkCount}</div>
          </div>
          <div className="metricCard">
            <div className="metricLabel">Мусор</div>
            <div className="metricValue">{summary.trashCount}</div>
          </div>
          <div className="metricCard">
            <div className="metricLabel">Играл</div>
            <div className="metricValue">{summary.playedCount}</div>
          </div>
          <div className="metricCard">
            <div className="metricLabel">Любимые в Играл</div>
            <div className="metricValue">{summary.playedFavoriteCount}</div>
          </div>
          <div className="metricCard">
            <div className="metricLabel">С апдейтами</div>
            <div className="metricValue">{summary.updatedCount}</div>
          </div>
        </div>
      </div>

      <div className="dashboardOverviewSectionGrid">
        <div className="panel">
          <div className="sectionTitleRow">
            <div className="sectionTitle">Срез по спискам</div>
            <div className="sectionMeta">{summary.totalTrackedCount} игр</div>
          </div>
          <div className="dashboardOverviewListGrid">
            {summary.listSummary.map((item) => (
              <div key={item.id} className="metricCard dashboardOverviewListCard">
                <div className="dashboardOverviewListCardHeader">
                  <div className="sectionTitle">{item.label}</div>
                  <div className="sectionMeta">{item.shareLabel}</div>
                </div>
                <div className="dashboardOverviewListCount">{item.count}</div>
                <div className="dashboardOverviewFactGrid">
                  <div className="dashboardOverviewFactItem">
                    <span className="metricLabel">Средний рейтинг</span>
                    <strong>{item.averageRatingLabel}</strong>
                  </div>
                  <div className="dashboardOverviewFactItem">
                    <span className="metricLabel">Апдейты</span>
                    <strong>{item.updatedCount}</strong>
                  </div>
                </div>
                <div className="dashboardOverviewMetaList">
                  <div className="smallText">
                    Топ тег: {item.topTagLabel ?? "Нет данных"}
                  </div>
                  <div className="smallText">
                    Топ движок: {item.topEngineLabel ?? "Нет данных"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="sectionTitleRow">
            <div className="sectionTitle">Общие метрики</div>
            <div className="sectionMeta">По всем спискам</div>
          </div>
          <div className="dashboardCardsRow dashboardOverviewCardsRow dashboardOverviewCompactCards">
            <div className="metricCard">
              <div className="metricLabel">Средний рейтинг</div>
              <div className="metricValue">{summary.averageRatingLabel}</div>
            </div>
            <div className="metricCard">
              <div className="metricLabel">Уникальных авторов</div>
              <div className="metricValue">{summary.uniqueCreatorCount}</div>
            </div>
            <div className="metricCard">
              <div className="metricLabel">Уникальных тегов</div>
              <div className="metricValue">{summary.uniqueTagCount}</div>
            </div>
            <div className="metricCard">
              <div className="metricLabel">Уникальных движков</div>
              <div className="metricValue">{summary.uniqueEngineCount}</div>
            </div>
            <div className="metricCard">
              <div className="metricLabel">Сумма лайков</div>
              <div className="metricValue">{summary.totalLikesLabel}</div>
            </div>
            <div className="metricCard">
              <div className="metricLabel">Сумма просмотров</div>
              <div className="metricValue">{summary.totalViewsLabel}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="dashboardOverviewSectionGrid">
        <div className="panel">
          <div className="sectionTitleRow">
            <div className="sectionTitle">Популярные теги</div>
            <div className="sectionMeta">Топ по всем спискам</div>
          </div>
          {renderCountPills(summary.topTags)}
        </div>

        <div className="panel">
          <div className="sectionTitleRow">
            <div className="sectionTitle">Популярные движки</div>
            <div className="sectionMeta">Топ по всем спискам</div>
          </div>
          {renderCountPills(summary.topEngines)}
        </div>

        <div className="panel">
          <div className="sectionTitleRow">
            <div className="sectionTitle">Частые авторы</div>
            <div className="sectionMeta">Топ по всем спискам</div>
          </div>
          {renderCountPills(summary.topCreators)}
        </div>
      </div>

      <div className="dashboardOverviewSectionGrid">
        <div className="panel">
          <div className="sectionTitleRow">
            <div className="sectionTitle">Последние добавления</div>
            <div className="sectionMeta">6 последних игр</div>
          </div>
          <div className="dashboardOverviewEntryList">
            {summary.recentItems.map((item) => (
              <div key={`recent-${item.threadLink}`} className="dashboardOverviewEntryItem">
                <div className="dashboardOverviewEntryTitle">{item.title}</div>
                <div className="dashboardOverviewEntryMeta">
                  <span className="dashboardOverviewEntryBadge">
                    {listLabelByType[item.listType]}
                  </span>
                  <span>{item.creator}</span>
                  <span>{formatDateTimeLabelFromSeconds(item.addedAt)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="sectionTitleRow">
            <div className="sectionTitle">Текущие апдейты</div>
            <div className="sectionMeta">{summary.updatedCount} игр</div>
          </div>
          {summary.updatedItems.length > 0 ? (
            <div className="dashboardOverviewEntryList">
              {summary.updatedItems.map((item) => (
                <div
                  key={`updated-${item.threadLink}`}
                  className="dashboardOverviewEntryItem"
                >
                  <div className="dashboardOverviewEntryTitle">{item.title}</div>
                  <div className="dashboardOverviewEntryMeta">
                    <span className="dashboardOverviewEntryBadge">
                      {listLabelByType[item.listType]}
                    </span>
                    <span>{item.updateLabel ?? "Есть новый апдейт"}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="smallText">Сейчас обновлений не найдено.</div>
          )}
        </div>
      </div>
    </div>
  );
};
