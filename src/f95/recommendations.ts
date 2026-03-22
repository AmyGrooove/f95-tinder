import type { F95ThreadItem, SessionState } from "./types";

type InterestLevel = "top" | "good" | "neutral" | "bad" | "trash";
type InterestTone = "positive" | "negative" | "neutral";
type InterestReasonKind = "tag" | "prefix" | "creator" | "rating" | "freshness";
type InterestSignalType = "playedFavorite" | "played" | "favorite" | "trash";
type InterestCandidate = Pick<
  F95ThreadItem,
  "tags" | "prefixes" | "creator" | "rating" | "new"
>;

type FeatureEvidence = {
  positive: number;
  negative: number;
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

type InterestProfile = {
  tagEvidenceById: Map<number, FeatureEvidence>;
  prefixEvidenceById: Map<number, FeatureEvidence>;
  creatorEvidenceByName: Map<string, FeatureEvidence>;
  trackedSignalsCount: number;
  positiveSignalsCount: number;
  negativeSignalsCount: number;
};

type ThreadInterestAssessment = {
  level: InterestLevel;
  label: string;
  summary: string;
  reasons: InterestReason[];
  score: number;
  rawScore: number;
  hasInsufficientData: boolean;
};

const SIGNAL_WEIGHT_BY_TYPE: Record<InterestSignalType, number> = {
  playedFavorite: 5,
  played: 3,
  favorite: 2,
  trash: -5,
};

const MIN_SIGNALS_FOR_STABLE_PROFILE = 8;
const TAG_CONTRIBUTION_WEIGHT = 1.65;
const PREFIX_CONTRIBUTION_WEIGHT = 1.05;
const CREATOR_CONTRIBUTION_WEIGHT = 1.3;
const REASON_LIMIT = 3;

const createEmptyInterestProfile = (): InterestProfile => ({
  tagEvidenceById: new Map<number, FeatureEvidence>(),
  prefixEvidenceById: new Map<number, FeatureEvidence>(),
  creatorEvidenceByName: new Map<string, FeatureEvidence>(),
  trackedSignalsCount: 0,
  positiveSignalsCount: 0,
  negativeSignalsCount: 0,
});

const normalizeCreatorName = (value: string | null | undefined) => {
  const normalizedValue = value?.trim();
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
  };
  map.set(key, nextEvidence);
  return nextEvidence;
};

const addEvidence = <Key,>(
  map: Map<Key, FeatureEvidence>,
  key: Key,
  signalWeight: number,
) => {
  const evidence = getOrCreateEvidence(map, key);
  if (signalWeight >= 0) {
    evidence.positive += signalWeight;
    return;
  }

  evidence.negative += Math.abs(signalWeight);
};

const getSignalTypeForLink = (
  threadLink: string,
  playedFavoriteSet: Set<string>,
  playedSet: Set<string>,
  favoriteSet: Set<string>,
  trashSet: Set<string>,
): InterestSignalType | null => {
  if (playedFavoriteSet.has(threadLink)) {
    return "playedFavorite";
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

const calculateFeatureContribution = (
  evidence: FeatureEvidence | undefined,
  maxContribution: number,
) => {
  if (!evidence) {
    return 0;
  }

  const totalEvidence = evidence.positive + evidence.negative;
  if (totalEvidence <= 0) {
    return 0;
  }

  const balance = (evidence.positive - evidence.negative) / (totalEvidence + 1.15);
  const strength = Math.min(1, totalEvidence / 4.5);

  return balance * strength * maxContribution;
};

const getRatingBonus = (rating: number | undefined) => {
  if (typeof rating !== "number" || !Number.isFinite(rating)) {
    return 0;
  }

  if (rating >= 4.6) {
    return 0.45;
  }
  if (rating >= 4.2) {
    return 0.3;
  }
  if (rating >= 3.8) {
    return 0.16;
  }

  return 0;
};

const getFreshnessBonus = (threadItem: InterestCandidate) => {
  return threadItem.new ? 0.18 : 0;
};

const toScore100 = (rawScore: number) => {
  const normalizedValue = (Math.tanh(rawScore / 2.8) + 1) / 2;
  return Math.round(normalizedValue * 100);
};

const toInterestLevel = (score: number): InterestLevel => {
  if (score >= 78) {
    return "top";
  }
  if (score >= 62) {
    return "good";
  }
  if (score >= 40) {
    return "neutral";
  }
  if (score >= 24) {
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
      : `Часто летит в мусор: ${contribution.label}`;
  }

  if (contribution.kind === "prefix") {
    return isPositive
      ? `Часто нравится: ${contribution.label}`
      : `Префикс обычно не заходит: ${contribution.label}`;
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
    return "Есть заметные совпадения с твоими любимыми тегами и префиксами.";
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
  const trashSet = new Set(sessionState.trashLinks);
  const trackedLinkSet = new Set<string>([
    ...favoriteSet,
    ...playedSet,
    ...trashSet,
  ]);

  for (const threadLink of trackedLinkSet) {
    const signalType = getSignalTypeForLink(
      threadLink,
      playedFavoriteSet,
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
    const prefixIdList = uniqueNumberList(processedItem.prefixes);
    const creatorName = normalizeCreatorName(processedItem.creator);

    accumulateTagEvidence(profile, tagIdList, signalWeight);
    accumulatePrefixEvidence(profile, prefixIdList, signalWeight);
    accumulateCreatorEvidence(profile, creatorName, signalWeight);

    profile.trackedSignalsCount += 1;
    if (signalWeight > 0) {
      profile.positiveSignalsCount += 1;
    } else {
      profile.negativeSignalsCount += 1;
    }
  }

  return profile;
};

const assessThreadInterest = (
  threadItem: InterestCandidate | null,
  profile: InterestProfile,
  tagsMap: Record<string, string>,
  prefixesMap: Record<string, string>,
): ThreadInterestAssessment | null => {
  if (!threadItem) {
    return null;
  }

  const contributionList: FeatureContribution[] = [];
  let rawScore = 0;

  for (const tagId of uniqueNumberList(threadItem.tags)) {
    const contribution = calculateFeatureContribution(
      profile.tagEvidenceById.get(tagId),
      TAG_CONTRIBUTION_WEIGHT,
    );

    if (contribution !== 0) {
      contributionList.push({
        kind: "tag",
        label: tagsMap[String(tagId)] ?? `#${tagId}`,
        value: contribution,
      });
      rawScore += contribution;
    }
  }

  for (const prefixId of uniqueNumberList(threadItem.prefixes)) {
    const contribution = calculateFeatureContribution(
      profile.prefixEvidenceById.get(prefixId),
      PREFIX_CONTRIBUTION_WEIGHT,
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
    const creatorContribution = calculateFeatureContribution(
      profile.creatorEvidenceByName.get(creatorName.toLowerCase()),
      CREATOR_CONTRIBUTION_WEIGHT,
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
  }

  const freshnessBonus = getFreshnessBonus(threadItem);
  if (freshnessBonus > 0) {
    contributionList.push({
      kind: "freshness",
      label: "freshness",
      value: freshnessBonus,
    });
    rawScore += freshnessBonus;
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

  const score = toScore100(rawScore);
  const level = hasInsufficientData ? "neutral" : toInterestLevel(score);

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
    rawScore,
    hasInsufficientData,
  };
};

export {
  assessThreadInterest,
  buildInterestProfile,
};

export type {
  InterestCandidate,
  InterestLevel,
  InterestProfile,
  InterestReason,
  ThreadInterestAssessment,
};
