import { useMemo, useState } from "react";
import { getEnginePrefixIdList } from "../f95/prefixes";
import {
  countUpdatedTrackedItems,
  getProcessedThreadItemUpdateLabel,
  hasProcessedThreadItemUpdate,
} from "../f95/updateTracking";
import type { ListType, ProcessedThreadItem, SessionState } from "../f95/types";
import { calculateAiTasteInfluencePercent } from "../f95/aiTasteProfile";
import type {
  AiTasteFeatureWeight,
  AiTasteFreshness,
  AiTasteProfileFile,
} from "../f95/aiTasteProfile";
import { AiTasteProfileModal } from "./AiTasteProfileModal";

type DashboardOverviewProps = {
  sessionState: SessionState;
  tagsMap: Record<string, string>;
  prefixesMap: Record<string, string>;
  aiTasteProfile: AiTasteProfileFile | null;
  aiTasteFreshness: AiTasteFreshness | null;
  isAiTasteEnabled: boolean;
  onAiTasteEnabledChange: (isEnabled: boolean) => void;
  onSaveAiTasteProfile: (profile: AiTasteProfileFile) => void;
  onClearAiTasteProfile: () => void;
};

type DashboardOverviewTab = "stats" | "history" | "ai";

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

type AiWeightViewItem = {
  key: string;
  label: string;
  scoreLabel: string;
  reason: string;
  tone: "positive" | "negative";
};

type AiWeightWithGroup = AiTasteFeatureWeight & {
  groupLabel: string;
};

const listLabelByType: Record<ListType, string> = {
  favorite: "Закладки",
  trash: "Мусор",
  played: "Играл",
};

const dashboardTabs: { id: DashboardOverviewTab; label: string }[] = [
  { id: "stats", label: "Статистика" },
  { id: "history", label: "История" },
  { id: "ai", label: "ИИ" },
];

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

const formatSignedNumber = (value: number) => {
  if (!Number.isFinite(value)) {
    return "0";
  }

  const roundedValue = Math.round(value * 100) / 100;
  return roundedValue > 0 ? `+${roundedValue}` : String(roundedValue);
};

const formatConfidenceLabel = (confidence: number) => {
  if (!Number.isFinite(confidence)) {
    return "0%";
  }

  return `${Math.round(Math.max(0, Math.min(1, confidence)) * 100)}%`;
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

const buildAiWeightViewItems = (
  weights: AiWeightWithGroup[],
  tone: "positive" | "negative",
  limit = 8,
): AiWeightViewItem[] => {
  return weights
    .filter((weightItem) => {
      return tone === "positive" ? weightItem.weight > 0 : weightItem.weight < 0;
    })
    .sort((firstWeight, secondWeight) => {
      const firstScore = Math.abs(firstWeight.weight) * firstWeight.confidence;
      const secondScore = Math.abs(secondWeight.weight) * secondWeight.confidence;
      if (secondScore !== firstScore) {
        return secondScore - firstScore;
      }
      return Math.abs(secondWeight.weight) - Math.abs(firstWeight.weight);
    })
    .slice(0, limit)
    .map((weightItem) => ({
      key: `${tone}-${weightItem.groupLabel}-${weightItem.value}`,
      label: `${weightItem.groupLabel}: ${weightItem.value}`,
      scoreLabel: `${formatSignedNumber(weightItem.weight)} · ${formatConfidenceLabel(
        weightItem.confidence,
      )}`,
      reason: weightItem.reason,
      tone,
    }));
};

const renderAiHighlightList = (items: string[]) => {
  if (items.length === 0) {
    return <div className="smallText">Пока нет данных</div>;
  }

  return (
    <div className="aiTasteHighlightList">
      {items.map((item) => (
        <div key={item} className="aiTasteHighlightItem">
          {item}
        </div>
      ))}
    </div>
  );
};

const renderAiWeightCards = (items: AiWeightViewItem[]) => {
  if (items.length === 0) {
    return <div className="smallText">Пока нет данных</div>;
  }

  return (
    <div className="aiTasteWeightGrid">
      {items.map((item) => (
        <div
          key={item.key}
          className={`aiTasteWeightCard ${
            item.tone === "positive" ? "aiTasteWeightPositive" : "aiTasteWeightNegative"
          }`}
        >
          <div className="aiTasteWeightHeader">
            <strong>{item.label}</strong>
            <span>{item.scoreLabel}</span>
          </div>
          <div className="smallText">{item.reason}</div>
        </div>
      ))}
    </div>
  );
};

export const DashboardOverview = ({
  sessionState,
  tagsMap,
  prefixesMap,
  aiTasteProfile,
  aiTasteFreshness,
  isAiTasteEnabled,
  onAiTasteEnabledChange,
  onSaveAiTasteProfile,
  onClearAiTasteProfile,
}: DashboardOverviewProps) => {
  const [activeTab, setActiveTab] = useState<DashboardOverviewTab>("stats");
  const [isAiTasteModalOpen, setIsAiTasteModalOpen] = useState(false);

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
        .slice(0, 8),
      updatedItems: trackedItems
        .filter((item) => item.isUpdated)
        .sort((first, second) => second.addedAt - first.addedAt)
        .slice(0, 8),
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

  const aiDashboardStats = useMemo(() => {
    if (!aiTasteProfile) {
      return null;
    }

    const weights: AiWeightWithGroup[] = [
      ...aiTasteProfile.tagWeights.map((weightItem) => ({
        ...weightItem,
        groupLabel: "Тег",
      })),
      ...aiTasteProfile.prefixWeights.map((weightItem) => ({
        ...weightItem,
        groupLabel: "Движок",
      })),
      ...aiTasteProfile.creatorWeights.map((weightItem) => ({
        ...weightItem,
        groupLabel: "Автор",
      })),
    ];

    const aiInfluencePercent = Math.round(
      calculateAiTasteInfluencePercent(aiTasteFreshness?.percent ?? null, isAiTasteEnabled) *
        100,
    );

    return {
      aiInfluencePercent,
      positiveWeights: buildAiWeightViewItems(weights, "positive"),
      negativeWeights: buildAiWeightViewItems(weights, "negative"),
      totalWeightsCount: weights.length,
      combinationRulesCount: aiTasteProfile.combinationRules.length,
      positiveSignalsCount: aiTasteProfile.sourceSnapshot.positiveSignalsCount,
      negativeSignalsCount: aiTasteProfile.sourceSnapshot.negativeSignalsCount,
      neutralSignalsCount: aiTasteProfile.sourceSnapshot.neutralSignalsCount,
    };
  }, [aiTasteFreshness?.percent, aiTasteProfile, isAiTasteEnabled]);

  const handleSaveAiTasteProfile = (profile: AiTasteProfileFile) => {
    onSaveAiTasteProfile(profile);
    onAiTasteEnabledChange(true);
  };

  const renderStatsTab = () => {
    if (summary.totalTrackedCount === 0) {
      return (
        <div className="panel">
          <div className="sectionTitleRow">
            <div>
              <h3 className="panelTitle dashboardPanelTitle">Общая статистика</h3>
              <div className="smallText">
                Сводка по Закладкам, Мусору и Играл.
              </div>
            </div>
            <div className="sectionMeta">
              Последняя синхронизация: {summary.lastMetadataSyncLabel}
            </div>
          </div>
          <div className="statusBox dashboardOverviewEmptyBox">
            <div className="dashboardOverviewEmptyTitle">В списках пока ничего нет</div>
            <div className="mutedText">
              Добавь игры в Закладки, Мусор или Играл, и здесь появится сводная
              статистика.
            </div>
          </div>
        </div>
      );
    }

    return (
      <>
        <div className="panel">
          <div className="sectionTitleRow">
            <div>
              <h3 className="panelTitle dashboardPanelTitle">Общая статистика</h3>
              <div className="smallText">
                Сводка по Закладкам, Мусору и Играл.
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
      </>
    );
  };

  const renderHistoryTab = () => {
    if (summary.totalTrackedCount === 0) {
      return (
        <div className="panel">
          <div className="sectionTitleRow">
            <div className="sectionTitle">История</div>
            <div className="sectionMeta">Пока пусто</div>
          </div>
          <div className="smallText">
            Здесь появятся последние добавления и игры с найденными апдейтами.
          </div>
        </div>
      );
    }

    return (
      <div className="dashboardOverviewSectionGrid">
        <div className="panel">
          <div className="sectionTitleRow">
            <div className="sectionTitle">Последние добавления</div>
            <div className="sectionMeta">8 последних игр</div>
          </div>
          <div className="dashboardOverviewEntryList">
            {summary.recentItems.map((item) => (
              <div key={`recent-${item.threadLink}`} className="dashboardOverviewEntryItem">
                <div className="dashboardOverviewEntryTitle">{item.title}</div>
                <div className="dashboardOverviewEntryMeta">
                  <span className="dashboardOverviewEntryBadge">
                    {listLabelByType[item.listType]}
                  </span>
                  {item.isPlayedFavorite ? (
                    <span className="dashboardOverviewEntryBadge">Любимое</span>
                  ) : null}
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
    );
  };

  const renderAiTab = () => {
    const shortStats = aiTasteProfile?.shortStats ?? null;

    return (
      <div className="panel aiTasteDashboardPanel">
        <div className="sectionTitleRow">
          <div>
            <div className="sectionTitle">ИИ-профиль вкуса</div>
            <div className="sectionMeta">
              {aiTasteProfile
                ? `Свежесть: ${aiTasteFreshness?.percent ?? 0}% · сигналов: ${aiTasteProfile.sourceSnapshot.trackedSignalsCount}`
                : "Профиль еще не создан"}
            </div>
          </div>
          <div className="aiTasteDashboardActions">
            <button
              className="button buttonPrimary"
              type="button"
              onClick={() => setIsAiTasteModalOpen(true)}
            >
              Поправить вкусы через промт
            </button>
            {aiTasteProfile ? (
              <button
                className="button buttonDanger"
                type="button"
                onClick={onClearAiTasteProfile}
              >
                Удалить ИИ-профиль
              </button>
            ) : null}
          </div>
        </div>

        <div className="aiTasteDashboardControlRow">
          <label className="dashboardPlayedFilterSwitch aiTasteToggle">
            <input
              className="dashboardPlayedFilterSwitchInput"
              type="checkbox"
              checked={Boolean(aiTasteProfile) && isAiTasteEnabled}
              disabled={!aiTasteProfile}
              onChange={(event) => onAiTasteEnabledChange(event.target.checked)}
            />
            <span className="dashboardPlayedFilterSwitchTrack" aria-hidden>
              <span className="dashboardPlayedFilterSwitchThumb" />
            </span>
            <span className="dashboardPlayedFilterSwitchLabel">
              Учитывать ИИ в системе интереса
            </span>
          </label>
          {aiTasteProfile && aiDashboardStats ? (
            <div className="sectionMeta">
              Текущее влияние: до {aiDashboardStats.aiInfluencePercent}% от итогового
              интереса
            </div>
          ) : null}
        </div>

        <div className="aiTasteDashboardSummary">
          {shortStats?.overview ||
            aiTasteProfile?.summary ||
            "Можно выгрузить выборку, прогнать ее через ChatGPT и импортировать профиль вкуса обратно."}
        </div>

        {aiTasteFreshness && aiTasteFreshness.percent < 70 ? (
          <div className="noticeMessage">
            Профиль частично устарел: добавлено {aiTasteFreshness.addedSignalsCount},
            изменено {aiTasteFreshness.changedSignalsCount}, удалено {aiTasteFreshness.removedSignalsCount}
            сигналов. Лучше обновить его через промт.
          </div>
        ) : null}

        {aiTasteProfile && aiDashboardStats ? (
          <>
            <div className="aiTasteDashboardStatGrid">
              <div className="metricCard aiTasteDashboardStatCard">
                <div className="metricLabel">Свежесть</div>
                <div className="metricValue">{aiTasteFreshness?.percent ?? 0}%</div>
              </div>
              <div className="metricCard aiTasteDashboardStatCard">
                <div className="metricLabel">Плюс-сигналы</div>
                <div className="metricValue">{aiDashboardStats.positiveSignalsCount}</div>
              </div>
              <div className="metricCard aiTasteDashboardStatCard">
                <div className="metricLabel">Минус-сигналы</div>
                <div className="metricValue">{aiDashboardStats.negativeSignalsCount}</div>
              </div>
              <div className="metricCard aiTasteDashboardStatCard">
                <div className="metricLabel">Нейтральные</div>
                <div className="metricValue">{aiDashboardStats.neutralSignalsCount}</div>
              </div>
              <div className="metricCard aiTasteDashboardStatCard">
                <div className="metricLabel">Весов признаков</div>
                <div className="metricValue">{aiDashboardStats.totalWeightsCount}</div>
              </div>
              <div className="metricCard aiTasteDashboardStatCard">
                <div className="metricLabel">Правил сочетаний</div>
                <div className="metricValue">{aiDashboardStats.combinationRulesCount}</div>
              </div>
            </div>

            {aiTasteFreshness ? (
              <div className="aiTasteFreshnessGrid">
                <div>
                  <span>Не изменились</span>
                  <strong>{aiTasteFreshness.stableSignalsCount}</strong>
                </div>
                <div>
                  <span>Добавлены</span>
                  <strong>{aiTasteFreshness.addedSignalsCount}</strong>
                </div>
                <div>
                  <span>Изменены</span>
                  <strong>{aiTasteFreshness.changedSignalsCount}</strong>
                </div>
                <div>
                  <span>Удалены</span>
                  <strong>{aiTasteFreshness.removedSignalsCount}</strong>
                </div>
              </div>
            ) : null}

            <div className="aiTasteHighlightsGrid">
              <div className="aiTasteHighlightPanel">
                <div className="sectionTitle">Что ИИ считает плюсом</div>
                {renderAiHighlightList(shortStats?.positiveHighlights ?? [])}
              </div>
              <div className="aiTasteHighlightPanel">
                <div className="sectionTitle">Что ИИ считает минусом</div>
                {renderAiHighlightList(shortStats?.negativeHighlights ?? [])}
              </div>
              <div className="aiTasteHighlightPanel aiTasteHighlightPanelWide">
                <div className="sectionTitle">Стратегия рекомендаций</div>
                <div className="smallText">
                  {shortStats?.recommendationStrategy ||
                    "ИИ-профиль добавляет вес совпадающим признакам, но обычная система рекомендаций остается основной."}
                </div>
              </div>
            </div>

            <div className="aiTasteHighlightsGrid">
              <div className="aiTasteHighlightPanel">
                <div className="sectionTitle">Сильные положительные признаки</div>
                {renderAiWeightCards(aiDashboardStats.positiveWeights)}
              </div>
              <div className="aiTasteHighlightPanel">
                <div className="sectionTitle">Сильные отрицательные признаки</div>
                {renderAiWeightCards(aiDashboardStats.negativeWeights)}
              </div>
            </div>
          </>
        ) : null}
      </div>
    );
  };

  return (
    <div className="dashboardOverview">
      <div className="settingsHeaderTop dashboardOverviewHeaderTop">
        <div className="settingsPageIntro">
          <h3 className="panelTitle settingsPageTitle">Дашборд</h3>
          <div className="smallText">
            Статистика списков, история изменений и ИИ-профиль вкуса.
          </div>
        </div>

        <div className="settingsTabBar" role="tablist" aria-label="Дашборд">
          {dashboardTabs.map((tab) => (
            <button
              key={tab.id}
              className={`button settingsTabButton ${
                activeTab === tab.id ? "settingsTabButtonActive" : ""
              }`}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "stats" ? renderStatsTab() : null}
      {activeTab === "history" ? renderHistoryTab() : null}
      {activeTab === "ai" ? renderAiTab() : null}

      {isAiTasteModalOpen ? (
        <AiTasteProfileModal
          sessionState={sessionState}
          tagsMap={tagsMap}
          prefixesMap={prefixesMap}
          onApplyProfile={handleSaveAiTasteProfile}
          onClose={() => setIsAiTasteModalOpen(false)}
        />
      ) : null}
    </div>
  );
};
