import type { F95ThreadItem, ProcessedThreadItem, SessionState } from "./types";
import { getEnginePrefixIdList } from "./prefixes";

type InterestLevel = "top" | "good" | "neutral" | "bad" | "trash";
type InterestTone = "positive" | "negative" | "neutral";
type InterestReasonKind = "tag" | "prefix" | "creator" | "rating" | "freshness";
type InterestSignalType =
  | "playedFavorite"
  | "playedDisliked"
  | "played"
  | "favorite"
  | "trash";
type InterestCandidate = Pick<
  F95ThreadItem,
  "tags" | "prefixes" | "creator" | "rating" | "new"
>;

type FeatureEvidence = {
  positive: number;
  negative: number;
  positiveSignalsCount: number;
  negativeSignalsCount: number;
};

type FeatureContribution = {
  kind: InterestReasonKind;
  label: string;
  value: number;
};

type InterestReason = {
  text: string;
  tone: InterestTone;
};

type FeatureSignalKind = "tag" | "prefix" | "creator";

type InterestProfile = {
  tagEvidenceById: Map<number, FeatureEvidence>;
  prefixEvidenceById: Map<number, FeatureEvidence>;
  creatorEvidenceByName: Map<string, FeatureEvidence>;
  trackedSignalsCount: number;
  positiveSignalsCount: number;
  negativeSignalsCount: number;
};

type CatalogFeatureStats = {
  threadCount: number;
  tagThreadCountById: Map<number, number>;
  prefixThreadCountById: Map<number, number>;
  creatorThreadCountByName: Map<string, number>;
};

type ThreadInterestAssessment = {
  level: InterestLevel;
  label: string;
  summary: string;
  reasons: InterestReason[];
  score: number;
  confidence: number;
  rawScore: number;
  hasInsufficientData: boolean;
};

const SIGNAL_WEIGHT_BY_TYPE: Record<InterestSignalType, number> = {
  playedFavorite: 5.2,
  playedDisliked: -3.6,
  played: 1.2,
  favorite: 2.7,
  trash: -1.35,
};

const MIN_SIGNALS_FOR_STABLE_PROFILE = 8;
const TAG_CONTRIBUTION_WEIGHT = 1.35;
const PREFIX_CONTRIBUTION_WEIGHT = 0.88;
const CREATOR_CONTRIBUTION_WEIGHT = 1.05;
const MAX_TAG_CONTRIBUTIONS_PER_THREAD = 4;
const MAX_TAG_CONTRIBUTION_MAGNITUDE = 1.55;
const REASON_LIMIT = 3;
const MIN_NEGATIVE_SIGNAL_SCALE = 0.16;
const BASELINE_RAW_SCORE = 0.24;
const LOW_CONFIDENCE_NEGATIVE_DAMPING = 0.42;
const NEGATIVE_CONTRIBUTION_DAMPING = 0.58;
const TRASH_LEVEL_MIN_CONFIDENCE = 0.72;
const TRASH_LEVEL_MIN_EVIDENCE_MAGNITUDE = 1.7;
const SIGNAL_RECENCY_HALF_LIFE_DAYS = 160;
const MIN_SIGNAL_RECENCY_WEIGHT = 0.35;
const SECONDS_PER_DAY = 24 * 60 * 60;
const MIN_CATALOG_THREADS_FOR_PREVALENCE_WEIGHT = 96;
const FEATURE_POLICY_BY_KIND: Record<
  FeatureSignalKind,
  {
    maxContribution: number;
    minimumReliableSupport: number;
    shrinkagePrior: number;
    minimumCoverageWeight: number;
    coveragePenaltyExponent: number;
  }
> = {
  tag: {
    maxContribution: TAG_CONTRIBUTION_WEIGHT,
    minimumReliableSupport: 2,
    shrinkagePrior: 1.4,
    minimumCoverageWeight: 0.56,
    coveragePenaltyExponent: 0.82,
  },
  prefix: {
    maxContribution: PREFIX_CONTRIBUTION_WEIGHT,
    minimumReliableSupport: 2,
    shrinkagePrior: 1.6,
    minimumCoverageWeight: 0.68,
    coveragePenaltyExponent: 0.95,
  },
  creator: {
    maxContribution: CREATOR_CONTRIBUTION_WEIGHT,
    minimumReliableSupport: 3,
    shrinkagePrior: 2.8,
    minimumCoverageWeight: 0.78,
    coveragePenaltyExponent: 1.1,
  },
};
const CATALOG_PREVALENCE_POLICY_BY_KIND: Record<
  FeatureSignalKind,
  {
    minimumWeight: number;
    maximumWeight: number;
  }
> = {
  tag: {
    minimumWeight: 0.62,
    maximumWeight: 1.08,
  },
  prefix: {
    minimumWeight: 0.74,
    maximumWeight: 1.04,
  },
  creator: {
    minimumWeight: 0.84,
    maximumWeight: 1.02,
  },
};

type InterestSignalEntry = {
  creatorName: string;
  prefixIdList: number[];
  signalWeight: number;
  signalTimestampUnixSeconds: number | null;
  tagIdList: number[];
};

const createEmptyInterestProfile = (): InterestProfile => ({
  tagEvidenceById: new Map<number, FeatureEvidence>(),
  prefixEvidenceById: new Map<number, FeatureEvidence>(),
  creatorEvidenceByName: new Map<string, FeatureEvidence>(),
  trackedSignalsCount: 0,
  positiveSignalsCount: 0,
  negativeSignalsCount: 0,
});

const createEmptyCatalogFeatureStats = (): CatalogFeatureStats => ({
  threadCount: 0,
  tagThreadCountById: new Map<number, number>(),
  prefixThreadCountById: new Map<number, number>(),
  creatorThreadCountByName: new Map<string, number>(),
});

const normalizeCreatorName = (value: unknown) => {
  const normalizedValue =
    typeof value === "string" ? value.trim() : "";
  if (!normalizedValue || normalizedValue.toLowerCase() === "unknown") {
    return "";
  }

  return normalizedValue;
};

const uniqueNumberList = (value: number[] | undefined) => {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value.filter(
        (item): item is number => Number.isInteger(item) && Number.isFinite(item),
      ),
    ),
  );
};

const normalizePositiveUnixTimestamp = (value: unknown) => {
  return typeof value === "number" &&
    Number.isFinite(value) &&
    Number.isInteger(value) &&
    value > 0
    ? value
    : null;
};

const resolveSignalTimestamp = (processedItem: ProcessedThreadItem) => {
  const addedAtUnixSeconds = normalizePositiveUnixTimestamp(
    processedItem.addedAtUnixSeconds,
  );
  if (addedAtUnixSeconds !== null) {
    return addedAtUnixSeconds;
  }

  return normalizePositiveUnixTimestamp(processedItem.trackedTs);
};

const getOrCreateEvidence = <Key,>(
  map: Map<Key, FeatureEvidence>,
  key: Key,
) => {
  const existingEvidence = map.get(key);
  if (existingEvidence) {
    return existingEvidence;
  }

  const nextEvidence: FeatureEvidence = {
    positive: 0,
    negative: 0,
    positiveSignalsCount: 0,
    negativeSignalsCount: 0,
  };
  map.set(key, nextEvidence);
  return nextEvidence;
};

const incrementCount = <Key,>(
  map: Map<Key, number>,
  key: Key,
) => {
  map.set(key, (map.get(key) ?? 0) + 1);
};

const addEvidence = <Key,>(
  map: Map<Key, FeatureEvidence>,
  key: Key,
  signalWeight: number,
) => {
  const evidence = getOrCreateEvidence(map, key);
  if (signalWeight >= 0) {
    evidence.positive += signalWeight;
    evidence.positiveSignalsCount += 1;
    return;
  }

  evidence.negative += Math.abs(signalWeight);
  evidence.negativeSignalsCount += 1;
};

const getSignalTypeForLink = (
  threadLink: string,
  playedFavoriteSet: Set<string>,
  playedDislikedSet: Set<string>,
  playedSet: Set<string>,
  favoriteSet: Set<string>,
  trashSet: Set<string>,
): InterestSignalType | null => {
  if (playedFavoriteSet.has(threadLink)) {
    return "playedFavorite";
  }
  if (playedDislikedSet.has(threadLink)) {
    return "playedDisliked";
  }
  if (trashSet.has(threadLink)) {
    return "trash";
  }
  if (playedSet.has(threadLink)) {
    return "played";
  }
  if (favoriteSet.has(threadLink)) {
    return "favorite";
  }
  return null;
};

const accumulateTagEvidence = (
  profile: InterestProfile,
  tagIdList: number[],
  signalWeight: number,
) => {
  if (tagIdList.length === 0) {
    return;
  }

  const distributedWeight =
    Math.abs(signalWeight) / Math.max(1.75, Math.sqrt(tagIdList.length) * 1.6);
  const signedWeight = Math.sign(signalWeight) * distributedWeight;

  for (const tagId of tagIdList) {
    addEvidence(profile.tagEvidenceById, tagId, signedWeight);
  }
};

const accumulatePrefixEvidence = (
  profile: InterestProfile,
  prefixIdList: number[],
  signalWeight: number,
) => {
  if (prefixIdList.length === 0) {
    return;
  }

  const distributedWeight =
    Math.abs(signalWeight) / Math.max(1.3, Math.sqrt(prefixIdList.length) * 1.25);
  const signedWeight = Math.sign(signalWeight) * distributedWeight;

  for (const prefixId of prefixIdList) {
    addEvidence(profile.prefixEvidenceById, prefixId, signedWeight);
  }
};

const accumulateCreatorEvidence = (
  profile: InterestProfile,
  creatorName: string,
  signalWeight: number,
) => {
  if (!creatorName) {
    return;
  }

  addEvidence(
    profile.creatorEvidenceByName,
    creatorName.toLowerCase(),
    signalWeight * 0.9,
  );
};

const getFeatureSupportCount = (evidence: FeatureEvidence) => {
  return evidence.positiveSignalsCount + evidence.negativeSignalsCount;
};

const getFeatureSupportWeight = (
  supportCount: number,
  minimumReliableSupport: number,
  shrinkagePrior: number,
) => {
  if (supportCount <= 0) {
    return 0;
  }

  const sparseSupportWeight =
    supportCount >= minimumReliableSupport
      ? 1
      : Math.max(0.18, supportCount / (minimumReliableSupport + 1));
  const shrinkageWeight = supportCount / (supportCount + shrinkagePrior);

  return sparseSupportWeight * shrinkageWeight;
};

const getFeatureCoverageWeight = (
  supportCount: number,
  trackedSignalsCount: number,
  minimumCoverageWeight: number,
  coveragePenaltyExponent: number,
) => {
  if (trackedSignalsCount < MIN_SIGNALS_FOR_STABLE_PROFILE || supportCount <= 1) {
    return 1;
  }

  const coverage = Math.min(1, Math.max(0, supportCount / trackedSignalsCount));

  return Math.max(
    minimumCoverageWeight,
    1 - Math.pow(coverage, coveragePenaltyExponent) * (1 - minimumCoverageWeight),
  );
};

const calculateFeatureContribution = (
  evidence: FeatureEvidence | undefined,
  trackedSignalsCount: number,
  featureKind: FeatureSignalKind,
) => {
  if (!evidence) {
    return 0;
  }

  const featurePolicy = FEATURE_POLICY_BY_KIND[featureKind];
  const totalEvidence = evidence.positive + evidence.negative;
  if (totalEvidence <= 0) {
    return 0;
  }

  const supportCount = getFeatureSupportCount(evidence);
  const supportWeight = getFeatureSupportWeight(
    supportCount,
    featurePolicy.minimumReliableSupport,
    featurePolicy.shrinkagePrior,
  );
  if (supportWeight <= 0) {
    return 0;
  }

  const coverageWeight = getFeatureCoverageWeight(
    supportCount,
    trackedSignalsCount,
    featurePolicy.minimumCoverageWeight,
    featurePolicy.coveragePenaltyExponent,
  );
  const balance = (evidence.positive - evidence.negative) / (totalEvidence + 1.15);
  const strength = Math.min(1, totalEvidence / 4.5);
  const contribution =
    balance *
    strength *
    featurePolicy.maxContribution *
    supportWeight *
    coverageWeight;

  if (contribution >= 0) {
    return contribution;
  }

  return (
    contribution *
    (totalEvidence < 2.25
      ? LOW_CONFIDENCE_NEGATIVE_DAMPING
      : NEGATIVE_CONTRIBUTION_DAMPING)
  );
};

const getNegativeSignalScale = (signalEntryList: InterestSignalEntry[]) => {
  let positiveSignalWeightTotal = 0;
  let negativeSignalWeightTotal = 0;

  for (const signalEntry of signalEntryList) {
    if (signalEntry.signalWeight > 0) {
      positiveSignalWeightTotal += signalEntry.signalWeight;
      continue;
    }

    negativeSignalWeightTotal += Math.abs(signalEntry.signalWeight);
  }

  if (negativeSignalWeightTotal <= 0) {
    return 1;
  }

  if (positiveSignalWeightTotal <= 0) {
    return MIN_NEGATIVE_SIGNAL_SCALE;
  }

  // Large trash lists should not overwhelm the taste profile purely by volume.
  return Math.max(
    MIN_NEGATIVE_SIGNAL_SCALE,
    Math.min(1, Math.sqrt(positiveSignalWeightTotal / negativeSignalWeightTotal)),
  );
};

const getSignalRecencyWeight = (
  signalTimestampUnixSeconds: number | null,
  newestSignalTimestampUnixSeconds: number | null,
) => {
  if (
    signalTimestampUnixSeconds === null ||
    newestSignalTimestampUnixSeconds === null ||
    signalTimestampUnixSeconds >= newestSignalTimestampUnixSeconds
  ) {
    return 1;
  }

  const ageDays =
    (newestSignalTimestampUnixSeconds - signalTimestampUnixSeconds) /
    SECONDS_PER_DAY;
  const decayedWeight = Math.pow(
    0.5,
    ageDays / SIGNAL_RECENCY_HALF_LIFE_DAYS,
  );

  return Math.max(MIN_SIGNAL_RECENCY_WEIGHT, decayedWeight);
};

const getRatingBonus = (rating: number | undefined) => {
  if (typeof rating !== "number" || !Number.isFinite(rating)) {
    return 0;
  }

  if (rating >= 4.7) {
    return 0.52;
  }
  if (rating >= 4.4) {
    return 0.38;
  }
  if (rating >= 4.0) {
    return 0.24;
  }
  if (rating >= 3.6) {
    return 0.12;
  }

  return 0;
};

const getFreshnessBonus = (threadItem: InterestCandidate) => {
  return threadItem.new ? 0.12 : 0;
};

const toScore100 = (rawScore: number) => {
  const normalizedValue = (Math.tanh(rawScore / 2.8) + 1) / 2;
  return Math.round(normalizedValue * 100);
};

const buildCatalogFeatureStats = (
  threadItemsByIdentifier: Record<string, F95ThreadItem>,
): CatalogFeatureStats => {
  const stats = createEmptyCatalogFeatureStats();
  const threadItemList = Object.values(threadItemsByIdentifier);
  stats.threadCount = threadItemList.length;

  for (const threadItem of threadItemList) {
    for (const tagId of uniqueNumberList(threadItem.tags)) {
      incrementCount(stats.tagThreadCountById, tagId);
    }

    for (const prefixId of getEnginePrefixIdList(threadItem.prefixes)) {
      incrementCount(stats.prefixThreadCountById, prefixId);
    }

    const creatorName = normalizeCreatorName(threadItem.creator);
    if (creatorName) {
      incrementCount(
        stats.creatorThreadCountByName,
        creatorName.toLowerCase(),
      );
    }
  }

  return stats;
};

const clamp01 = (value: number) => {
  return Math.min(1, Math.max(0, value));
};

const getCatalogFeaturePrevalenceWeight = (
  occurrenceCount: number | undefined,
  catalogFeatureStats: CatalogFeatureStats | null | undefined,
  featureKind: FeatureSignalKind,
) => {
  if (
    !catalogFeatureStats ||
    catalogFeatureStats.threadCount < MIN_CATALOG_THREADS_FOR_PREVALENCE_WEIGHT ||
    typeof occurrenceCount !== "number" ||
    !Number.isFinite(occurrenceCount) ||
    occurrenceCount <= 0
  ) {
    return 1;
  }

  const policy = CATALOG_PREVALENCE_POLICY_BY_KIND[featureKind];
  const rarityWeight = clamp01(
    Math.log1p(catalogFeatureStats.threadCount / occurrenceCount) /
      Math.log1p(catalogFeatureStats.threadCount),
  );

  return (
    policy.minimumWeight +
    rarityWeight * (policy.maximumWeight - policy.minimumWeight)
  );
};

const clampContributionMagnitude = (
  value: number,
  maxMagnitude: number,
) => {
  if (maxMagnitude <= 0) {
    return 0;
  }

  return Math.sign(value) * Math.min(Math.abs(value), maxMagnitude);
};

const getCappedContributionGroupTotal = (
  contributionList: FeatureContribution[],
  maxContributionCount: number,
  maxMagnitude: number,
) => {
  if (contributionList.length === 0) {
    return 0;
  }

  const rawTotal = contributionList
    .slice()
    .sort((first, second) => Math.abs(second.value) - Math.abs(first.value))
    .slice(0, maxContributionCount)
    .reduce((sum, contribution) => sum + contribution.value, 0);

  return clampContributionMagnitude(rawTotal, maxMagnitude);
};

const getInterestConfidence = (
  profile: InterestProfile,
  evidenceMagnitude: number,
) => {
  if (profile.trackedSignalsCount <= 0 || evidenceMagnitude <= 0) {
    return 0;
  }

  const trackedSignalsConfidence = clamp01(
    profile.trackedSignalsCount / MIN_SIGNALS_FOR_STABLE_PROFILE,
  );
  const evidenceConfidence = clamp01(evidenceMagnitude / 1.2);

  return clamp01(
    Math.sqrt(trackedSignalsConfidence * evidenceConfidence),
  );
};

const blendScoreByConfidence = (
  baselineScore: number,
  personalizedScore: number,
  confidence: number,
) => {
  return Math.round(
    baselineScore +
      (personalizedScore - baselineScore) * clamp01(confidence),
  );
};

const resolveInterestLevel = (
  score: number,
  confidence: number,
  evidenceMagnitude: number,
) => {
  const level = toInterestLevel(score);
  if (
    level === "trash" &&
    (confidence < TRASH_LEVEL_MIN_CONFIDENCE ||
      evidenceMagnitude < TRASH_LEVEL_MIN_EVIDENCE_MAGNITUDE)
  ) {
    return "bad" as const;
  }

  return level;
};

const toInterestLevel = (score: number): InterestLevel => {
  if (score >= 80) {
    return "top";
  }
  if (score >= 63) {
    return "good";
  }
  if (score >= 34) {
    return "neutral";
  }
  if (score >= 16) {
    return "bad";
  }
  return "trash";
};

const toReasonText = (
  contribution: FeatureContribution,
  isPositive: boolean,
) => {
  if (contribution.kind === "tag") {
    return isPositive
      ? `Любимый тег: ${contribution.label}`
      : `Часто не заходит: ${contribution.label}`;
  }

  if (contribution.kind === "prefix") {
    return isPositive
      ? `Движок часто нравится: ${contribution.label}`
      : `Движок обычно не заходит: ${contribution.label}`;
  }

  if (contribution.kind === "creator") {
    return isPositive
      ? `Нравится автор: ${contribution.label}`
      : `Автор чаще мимо: ${contribution.label}`;
  }

  if (contribution.kind === "rating") {
    return "Высокий рейтинг";
  }

  return "Свежая новинка";
};

const buildReasonList = (
  contributionList: FeatureContribution[],
  hasInsufficientData: boolean,
) => {
  const significantContributionList = contributionList
    .filter((contribution) => Math.abs(contribution.value) >= 0.18)
    .sort((first, second) => Math.abs(second.value) - Math.abs(first.value))
    .slice(0, REASON_LIMIT);

  if (significantContributionList.length === 0) {
    return hasInsufficientData
      ? [
          {
            text: "Пока мало оцененных игр для уверенного профиля вкуса",
            tone: "neutral" as const,
          },
        ]
      : [];
  }

  return significantContributionList.map((contribution) => ({
    text: toReasonText(contribution, contribution.value >= 0),
    tone:
      contribution.value > 0
        ? ("positive" as const)
        : contribution.value < 0
          ? ("negative" as const)
          : ("neutral" as const),
  }));
};

const buildSummary = (
  level: InterestLevel,
  hasInsufficientData: boolean,
  contributionList: FeatureContribution[],
  trackedSignalsCount: number,
) => {
  if (trackedSignalsCount === 0) {
    return "Профиль вкуса пустой: сначала разметь несколько игр.";
  }

  if (hasInsufficientData) {
    return "Оценка осторожная: сигналов вкуса пока маловато.";
  }

  const positiveContributionsCount = contributionList.filter(
    (contribution) => contribution.value > 0.16,
  ).length;
  const negativeContributionsCount = contributionList.filter(
    (contribution) => contribution.value < -0.16,
  ).length;

  if (level === "top") {
    return "Сильное совпадение с тем, что у тебя уже хорошо заходило.";
  }

  if (level === "good") {
    return "Есть заметные совпадения с твоими любимыми тегами и движками.";
  }

  if (level === "trash") {
    return "Есть явные совпадения с тем, что ты обычно отправляешь в мусор.";
  }

  if (level === "bad") {
    return "Сигнал скорее отрицательный: совпадений с любимым мало.";
  }

  if (positiveContributionsCount > 0 && negativeContributionsCount > 0) {
    return "Сигнал смешанный: есть и хорошие совпадения, и анти-паттерны.";
  }

  return "Явного сигнала вкуса пока нет.";
};

const buildLabel = (level: InterestLevel, hasInsufficientData: boolean) => {
  if (hasInsufficientData) {
    return "Недостаточно данных";
  }

  if (level === "top") {
    return "Топ";
  }
  if (level === "good") {
    return "Хорошая";
  }
  if (level === "bad") {
    return "Не очень";
  }
  if (level === "trash") {
    return "Туфта";
  }
  return "Нейтрал";
};

const buildInterestProfile = (sessionState: SessionState): InterestProfile => {
  const profile = createEmptyInterestProfile();
  const favoriteSet = new Set(sessionState.favoritesLinks);
  const playedSet = new Set(sessionState.playedLinks);
  const playedFavoriteSet = new Set(sessionState.playedFavoriteLinks);
  const playedDislikedSet = new Set(sessionState.playedDislikedLinks);
  const trashSet = new Set(sessionState.trashLinks);
  const trackedLinkSet = new Set<string>([
    ...favoriteSet,
    ...playedSet,
    ...trashSet,
  ]);
  const signalEntryList: InterestSignalEntry[] = [];
  let newestSignalTimestampUnixSeconds: number | null = null;

  for (const threadLink of trackedLinkSet) {
    const signalType = getSignalTypeForLink(
      threadLink,
      playedFavoriteSet,
      playedDislikedSet,
      playedSet,
      favoriteSet,
      trashSet,
    );
    if (!signalType) {
      continue;
    }

    const processedItem = sessionState.processedThreadItemsByLink[threadLink];
    if (!processedItem) {
      continue;
    }

    const signalWeight = SIGNAL_WEIGHT_BY_TYPE[signalType];
    const tagIdList = uniqueNumberList(processedItem.tags);
    const prefixIdList = getEnginePrefixIdList(processedItem.prefixes);
    const creatorName = normalizeCreatorName(processedItem.creator);
    const signalTimestampUnixSeconds = resolveSignalTimestamp(processedItem);

    if (
      signalTimestampUnixSeconds !== null &&
      (newestSignalTimestampUnixSeconds === null ||
        signalTimestampUnixSeconds > newestSignalTimestampUnixSeconds)
    ) {
      newestSignalTimestampUnixSeconds = signalTimestampUnixSeconds;
    }

    signalEntryList.push({
      creatorName,
      prefixIdList,
      signalWeight,
      signalTimestampUnixSeconds,
      tagIdList,
    });

    profile.trackedSignalsCount += 1;
    if (signalWeight > 0) {
      profile.positiveSignalsCount += 1;
    } else {
      profile.negativeSignalsCount += 1;
    }
  }

  const recencyAdjustedSignalEntryList = signalEntryList.map((signalEntry) => ({
    ...signalEntry,
    signalWeight:
      signalEntry.signalWeight *
      getSignalRecencyWeight(
        signalEntry.signalTimestampUnixSeconds,
        newestSignalTimestampUnixSeconds,
      ),
  }));

  const negativeSignalScale = getNegativeSignalScale(
    recencyAdjustedSignalEntryList,
  );

  for (const signalEntry of recencyAdjustedSignalEntryList) {
    const adjustedSignalWeight =
      signalEntry.signalWeight < 0
        ? signalEntry.signalWeight * negativeSignalScale
        : signalEntry.signalWeight;

    accumulateTagEvidence(profile, signalEntry.tagIdList, adjustedSignalWeight);
    accumulatePrefixEvidence(
      profile,
      signalEntry.prefixIdList,
      adjustedSignalWeight,
    );
    accumulateCreatorEvidence(
      profile,
      signalEntry.creatorName,
      adjustedSignalWeight,
    );
  }

  return profile;
};

const assessThreadInterest = (
  threadItem: InterestCandidate | null,
  profile: InterestProfile,
  tagsMap: Record<string, string>,
  prefixesMap: Record<string, string>,
  catalogFeatureStats?: CatalogFeatureStats | null,
): ThreadInterestAssessment | null => {
  if (!threadItem) {
    return null;
  }

  const contributionList: FeatureContribution[] = [];
  const tagContributionList: FeatureContribution[] = [];
  let rawScore = BASELINE_RAW_SCORE;
  let baselineRawScore = 0;

  for (const tagId of uniqueNumberList(threadItem.tags)) {
    const baseContribution = calculateFeatureContribution(
      profile.tagEvidenceById.get(tagId),
      profile.trackedSignalsCount,
      "tag",
    );

    const contribution =
      baseContribution *
      getCatalogFeaturePrevalenceWeight(
        catalogFeatureStats?.tagThreadCountById.get(tagId),
        catalogFeatureStats,
        "tag",
      );

    if (contribution !== 0) {
      tagContributionList.push({
        kind: "tag",
        label: tagsMap[String(tagId)] ?? `#${tagId}`,
        value: contribution,
      });
    }
  }

  contributionList.push(...tagContributionList);
  rawScore += getCappedContributionGroupTotal(
    tagContributionList,
    MAX_TAG_CONTRIBUTIONS_PER_THREAD,
    MAX_TAG_CONTRIBUTION_MAGNITUDE,
  );

  for (const prefixId of getEnginePrefixIdList(threadItem.prefixes)) {
    const baseContribution = calculateFeatureContribution(
      profile.prefixEvidenceById.get(prefixId),
      profile.trackedSignalsCount,
      "prefix",
    );

    const contribution =
      baseContribution *
      getCatalogFeaturePrevalenceWeight(
        catalogFeatureStats?.prefixThreadCountById.get(prefixId),
        catalogFeatureStats,
        "prefix",
      );

    if (contribution !== 0) {
      contributionList.push({
        kind: "prefix",
        label: prefixesMap[String(prefixId)] ?? `#${prefixId}`,
        value: contribution,
      });
      rawScore += contribution;
    }
  }

  const creatorName = normalizeCreatorName(threadItem.creator);
  if (creatorName) {
    const baseCreatorContribution = calculateFeatureContribution(
      profile.creatorEvidenceByName.get(creatorName.toLowerCase()),
      profile.trackedSignalsCount,
      "creator",
    );
    const creatorContribution =
      baseCreatorContribution *
      getCatalogFeaturePrevalenceWeight(
        catalogFeatureStats?.creatorThreadCountByName.get(
          creatorName.toLowerCase(),
        ),
        catalogFeatureStats,
        "creator",
      );

    if (creatorContribution !== 0) {
      contributionList.push({
        kind: "creator",
        label: creatorName,
        value: creatorContribution,
      });
      rawScore += creatorContribution;
    }
  }

  const ratingBonus = getRatingBonus(threadItem.rating);
  if (ratingBonus > 0) {
    contributionList.push({
      kind: "rating",
      label: "rating",
      value: ratingBonus,
    });
    rawScore += ratingBonus;
    baselineRawScore += ratingBonus;
  }

  const freshnessBonus = getFreshnessBonus(threadItem);
  if (freshnessBonus > 0) {
    contributionList.push({
      kind: "freshness",
      label: "freshness",
      value: freshnessBonus,
    });
    rawScore += freshnessBonus;
    baselineRawScore += freshnessBonus;
  }

  const evidenceMagnitude = contributionList.reduce((sum, contribution) => {
    if (contribution.kind === "rating" || contribution.kind === "freshness") {
      return sum;
    }
    return sum + Math.abs(contribution.value);
  }, 0);

  const hasInsufficientData =
    profile.trackedSignalsCount < 4 ||
    (profile.trackedSignalsCount < MIN_SIGNALS_FOR_STABLE_PROFILE &&
      evidenceMagnitude < 0.9);

  const confidence = getInterestConfidence(profile, evidenceMagnitude);
  const score = blendScoreByConfidence(
    toScore100(baselineRawScore),
    toScore100(rawScore),
    confidence,
  );
  const level = hasInsufficientData
    ? "neutral"
    : resolveInterestLevel(score, confidence, evidenceMagnitude);

  return {
    level,
    label: buildLabel(level, hasInsufficientData),
    summary: buildSummary(
      level,
      hasInsufficientData,
      contributionList,
      profile.trackedSignalsCount,
    ),
    reasons: buildReasonList(contributionList, hasInsufficientData),
    score,
    confidence,
    rawScore,
    hasInsufficientData,
  };
};

export {
  assessThreadInterest,
  buildCatalogFeatureStats,
  buildInterestProfile,
};

export type {
  CatalogFeatureStats,
  InterestCandidate,
  InterestLevel,
  InterestProfile,
  InterestReason,
  ThreadInterestAssessment,
};
