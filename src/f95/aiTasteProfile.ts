import type { F95ThreadItem, ProcessedThreadItem, SessionState } from './types'
import { getEnginePrefixIdList } from './prefixes'
import { safeJsonParse } from './utils'

const AI_TASTE_SAMPLE_FORMAT = 'f95-tinder-ai-taste-sample-v1'
const AI_TASTE_PROFILE_FORMAT = 'f95-tinder-ai-taste-profile-v1'
const BEST_SAMPLE_POSITIVE_LIMIT = 48
const BEST_SAMPLE_NEGATIVE_LIMIT = 48
const BEST_SAMPLE_NEUTRAL_LIMIT = 24
const MAX_AI_REASON_COUNT = 4
const MAX_AI_RAW_SCORE_MAGNITUDE = 7
const MAX_AI_INFLUENCE = 0.3

type AiTasteSampleMode = 'best' | 'full'

type AiTasteSignalType =
  | 'playedFavorite'
  | 'playedDisliked'
  | 'played'
  | 'favorite'
  | 'trash'

type AiTasteSourceSnapshot = {
  trackedSignalsCount: number
  positiveSignalsCount: number
  negativeSignalsCount: number
  neutralSignalsCount: number
  signalByLink: Record<string, AiTasteSignalType>
}

type AiTasteGameItem = {
  threadLink: string
  threadIdentifier: number | null
  title: string
  creator: string
  rating: number
  tags: string[]
  prefixes: string[]
  signal: AiTasteSignalType
  addedAtUnixSeconds: number
  version: string
}

type AiTasteFeatureStat = {
  value: string
  positiveCount: number
  negativeCount: number
  neutralCount: number
  totalCount: number
}

type AiTasteSampleStats = {
  totalGamesCount: number
  likedGamesCount: number
  dislikedGamesCount: number
  neutralPlayedGamesCount: number
  bookmarkedGamesCount: number
  trashGamesCount: number
  topPositiveFeatures: AiTasteFeatureStat[]
  topNegativeFeatures: AiTasteFeatureStat[]
}

type AiTasteSampleFile = {
  format: typeof AI_TASTE_SAMPLE_FORMAT
  exportedAtUnixMs: number
  sampleMode: AiTasteSampleMode
  sourceSnapshot: AiTasteSourceSnapshot
  dictionaries: {
    tagsById: Record<string, string>
    prefixesById: Record<string, string>
  }
  userSignals: {
    likedGames: AiTasteGameItem[]
    dislikedGames: AiTasteGameItem[]
    neutralPlayedGames: AiTasteGameItem[]
    bookmarkedGames: AiTasteGameItem[]
    trashGames: AiTasteGameItem[]
  }
  featureStats: {
    tags: AiTasteFeatureStat[]
    prefixes: AiTasteFeatureStat[]
    creators: AiTasteFeatureStat[]
  }
  sampleStats: AiTasteSampleStats
}

type AiTasteFeatureWeight = {
  value: string
  weight: number
  confidence: number
  reason: string
}

type AiTasteCombinationRule = {
  values: string[]
  weight: number
  confidence: number
  reason: string
}

type AiTasteShortStats = {
  overview: string
  positiveHighlights: string[]
  negativeHighlights: string[]
  recommendationStrategy: string
}

type AiTasteProfileFile = {
  format: typeof AI_TASTE_PROFILE_FORMAT
  createdAtUnixMs: number
  sourceSnapshot: AiTasteSourceSnapshot
  summary: string
  shortStats?: AiTasteShortStats
  tagWeights: AiTasteFeatureWeight[]
  prefixWeights: AiTasteFeatureWeight[]
  creatorWeights: AiTasteFeatureWeight[]
  combinationRules: AiTasteCombinationRule[]
}

type AiTasteFreshness = {
  percent: number
  stableSignalsCount: number
  changedSignalsCount: number
  addedSignalsCount: number
  removedSignalsCount: number
  previousSignalsCount: number
  currentSignalsCount: number
}

type AiTasteReason = {
  text: string
  tone: 'positive' | 'negative'
}

type AiTasteAssessment = {
  score: number
  rawScore: number
  confidence: number
  reasons: AiTasteReason[]
  summary: string
}

type AiTasteCandidate = Pick<
  F95ThreadItem,
  'tags' | 'prefixes' | 'creator' | 'rating'
>

type AiTasteScoredGameItem = AiTasteGameItem & {
  samplingScore: number
}

type FeatureAccumulator = {
  positiveCount: number
  negativeCount: number
  neutralCount: number
}

const clamp = (value: number, minimumValue: number, maximumValue: number) => {
  return Math.min(maximumValue, Math.max(minimumValue, value))
}

const normalizeTextValue = (value: unknown) => {
  return typeof value === 'string' ? value.trim() : ''
}

const normalizeFeatureKey = (value: string) => value.trim().toLowerCase()

const normalizeFiniteNumber = (value: unknown, fallbackValue = 0) => {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : fallbackValue
}

const normalizeIntegerUnixMs = (value: unknown) => {
  const normalizedValue = normalizeFiniteNumber(value)
  return normalizedValue > 0 ? Math.round(normalizedValue) : Date.now()
}

const normalizeThreadIdentifierFromLink = (threadLink: string) => {
  const match = /\/threads\/(\d+)/.exec(threadLink)
  if (!match) {
    return null
  }

  return Number(match[1])
}

const normalizeNumberList = (value: unknown) => {
  if (!Array.isArray(value)) {
    return []
  }

  return Array.from(
    new Set(
      value.filter(
        (item): item is number =>
          Number.isInteger(item) && Number.isFinite(item),
      ),
    ),
  )
}

const normalizeLookupMap = (value: Record<string, string>) => {
  const normalizedLookupMap: Record<string, string> = {}

  for (const [rawKey, rawValue] of Object.entries(value)) {
    const key = String(rawKey)
    const label = normalizeTextValue(rawValue)
    if (key && label) {
      normalizedLookupMap[key] = label
    }
  }

  return normalizedLookupMap
}

const getFeatureLabel = (
  featureId: number,
  lookupMap: Record<string, string>,
) => {
  return lookupMap[String(featureId)] ?? `#${featureId}`
}

const getProcessedItemForLink = (
  sessionState: SessionState,
  threadLink: string,
) => {
  return sessionState.processedThreadItemsByLink[threadLink] ?? null
}

const getThreadItemForLink = (
  sessionState: SessionState,
  threadLink: string,
) => {
  const threadIdentifier = normalizeThreadIdentifierFromLink(threadLink)
  if (threadIdentifier === null) {
    return null
  }

  return sessionState.threadItemsByIdentifier[String(threadIdentifier)] ?? null
}

const getSignalTypeForLink = (
  threadLink: string,
  playedFavoriteLinkSet: Set<string>,
  playedDislikedLinkSet: Set<string>,
  playedLinkSet: Set<string>,
  favoriteLinkSet: Set<string>,
  trashLinkSet: Set<string>,
): AiTasteSignalType | null => {
  if (playedFavoriteLinkSet.has(threadLink)) {
    return 'playedFavorite'
  }

  if (playedDislikedLinkSet.has(threadLink)) {
    return 'playedDisliked'
  }

  if (playedLinkSet.has(threadLink)) {
    return 'played'
  }

  if (favoriteLinkSet.has(threadLink)) {
    return 'favorite'
  }

  if (trashLinkSet.has(threadLink)) {
    return 'trash'
  }

  return null
}

const getSignalTone = (signalType: AiTasteSignalType) => {
  if (signalType === 'playedFavorite' || signalType === 'favorite') {
    return 'positive'
  }

  if (signalType === 'playedDisliked' || signalType === 'trash') {
    return 'negative'
  }

  return 'neutral'
}

const buildTrackedSignalByLink = (sessionState: SessionState) => {
  const favoriteLinkSet = new Set(sessionState.favoritesLinks)
  const trashLinkSet = new Set(sessionState.trashLinks)
  const playedLinkSet = new Set(sessionState.playedLinks)
  const playedFavoriteLinkSet = new Set(sessionState.playedFavoriteLinks)
  const playedDislikedLinkSet = new Set(sessionState.playedDislikedLinks)
  const trackedLinkSet = new Set<string>([
    ...favoriteLinkSet,
    ...trashLinkSet,
    ...playedLinkSet,
    ...playedFavoriteLinkSet,
    ...playedDislikedLinkSet,
  ])
  const signalByLink: Record<string, AiTasteSignalType> = {}

  for (const threadLink of trackedLinkSet) {
    const signalType = getSignalTypeForLink(
      threadLink,
      playedFavoriteLinkSet,
      playedDislikedLinkSet,
      playedLinkSet,
      favoriteLinkSet,
      trashLinkSet,
    )
    if (signalType) {
      signalByLink[threadLink] = signalType
    }
  }

  return signalByLink
}

const buildAiTasteSourceSnapshot = (
  sessionState: SessionState,
): AiTasteSourceSnapshot => {
  const signalByLink = buildTrackedSignalByLink(sessionState)
  let positiveSignalsCount = 0
  let negativeSignalsCount = 0
  let neutralSignalsCount = 0

  for (const signalType of Object.values(signalByLink)) {
    const signalTone = getSignalTone(signalType)
    if (signalTone === 'positive') {
      positiveSignalsCount += 1
    } else if (signalTone === 'negative') {
      negativeSignalsCount += 1
    } else {
      neutralSignalsCount += 1
    }
  }

  return {
    trackedSignalsCount: Object.keys(signalByLink).length,
    positiveSignalsCount,
    negativeSignalsCount,
    neutralSignalsCount,
    signalByLink,
  }
}

const calculateAiTasteFreshness = (
  profile: AiTasteProfileFile | null,
  sessionState: SessionState,
): AiTasteFreshness | null => {
  if (!profile) {
    return null
  }

  const previousSignalByLink = profile.sourceSnapshot.signalByLink
  const currentSignalByLink = buildTrackedSignalByLink(sessionState)
  const previousLinkSet = new Set(Object.keys(previousSignalByLink))
  const currentLinkSet = new Set(Object.keys(currentSignalByLink))
  let stableSignalsCount = 0
  let changedSignalsCount = 0
  let addedSignalsCount = 0
  let removedSignalsCount = 0

  for (const previousThreadLink of previousLinkSet) {
    const currentSignalType = currentSignalByLink[previousThreadLink]
    if (!currentSignalType) {
      removedSignalsCount += 1
      continue
    }

    if (currentSignalType === previousSignalByLink[previousThreadLink]) {
      stableSignalsCount += 1
      continue
    }

    changedSignalsCount += 1
  }

  for (const currentThreadLink of currentLinkSet) {
    if (!previousLinkSet.has(currentThreadLink)) {
      addedSignalsCount += 1
    }
  }

  const previousSignalsCount = previousLinkSet.size
  const currentSignalsCount = currentLinkSet.size
  const comparisonBaseCount = Math.max(previousSignalsCount, currentSignalsCount, 1)
  const percent = clamp(
    Math.round((stableSignalsCount / comparisonBaseCount) * 100),
    0,
    100,
  )

  return {
    percent,
    stableSignalsCount,
    changedSignalsCount,
    addedSignalsCount,
    removedSignalsCount,
    previousSignalsCount,
    currentSignalsCount,
  }
}

const resolveGameItemValue = <Value,>(
  processedValue: Value | undefined,
  threadValue: Value | undefined,
  fallbackValue: Value,
) => {
  if (processedValue !== undefined && processedValue !== null) {
    return processedValue
  }

  if (threadValue !== undefined && threadValue !== null) {
    return threadValue
  }

  return fallbackValue
}

const buildAiTasteGameItem = (
  threadLink: string,
  signalType: AiTasteSignalType,
  sessionState: SessionState,
  tagsMap: Record<string, string>,
  prefixesMap: Record<string, string>,
): AiTasteGameItem | null => {
  const processedItem = getProcessedItemForLink(sessionState, threadLink)
  const threadItem = getThreadItemForLink(sessionState, threadLink)

  if (!processedItem && !threadItem) {
    return null
  }

  const threadIdentifier =
    processedItem?.threadIdentifier ??
    threadItem?.thread_id ??
    normalizeThreadIdentifierFromLink(threadLink)
  const tags = normalizeNumberList(
    resolveGameItemValue(processedItem?.tags, threadItem?.tags, []),
  ).map((tagId) => getFeatureLabel(tagId, tagsMap))
  const prefixes = getEnginePrefixIdList(
    normalizeNumberList(
      resolveGameItemValue(processedItem?.prefixes, threadItem?.prefixes, []),
    ),
  ).map((prefixId) => getFeatureLabel(prefixId, prefixesMap))

  return {
    threadLink,
    threadIdentifier,
    title: normalizeTextValue(
      resolveGameItemValue(processedItem?.title, threadItem?.title, ''),
    ),
    creator: normalizeTextValue(
      resolveGameItemValue(processedItem?.creator, threadItem?.creator, ''),
    ),
    rating: normalizeFiniteNumber(
      resolveGameItemValue(processedItem?.rating, threadItem?.rating, 0),
    ),
    tags,
    prefixes,
    signal: signalType,
    addedAtUnixSeconds: normalizeFiniteNumber(processedItem?.addedAtUnixSeconds),
    version: normalizeTextValue(
      resolveGameItemValue(processedItem?.version, threadItem?.version, ''),
    ),
  }
}

const getSamplingScore = (gameItem: AiTasteGameItem) => {
  const signalPriority =
    gameItem.signal === 'playedFavorite' || gameItem.signal === 'playedDisliked'
      ? 100
      : gameItem.signal === 'favorite' || gameItem.signal === 'trash'
        ? 60
        : 20
  const ratingScore = clamp(gameItem.rating, 0, 5) * 8
  const recencyScore = gameItem.addedAtUnixSeconds > 0 ? gameItem.addedAtUnixSeconds / 1_000_000 : 0

  return signalPriority + ratingScore + recencyScore
}

const limitGameItems = (
  gameItems: AiTasteGameItem[],
  sampleMode: AiTasteSampleMode,
  limit: number,
) => {
  if (sampleMode === 'full') {
    return gameItems
  }

  return gameItems
    .map((gameItem): AiTasteScoredGameItem => ({
      ...gameItem,
      samplingScore: getSamplingScore(gameItem),
    }))
    .sort((firstItem, secondItem) => secondItem.samplingScore - firstItem.samplingScore)
    .slice(0, limit)
    .map(({ samplingScore: _samplingScore, ...gameItem }) => gameItem)
}

const getOrCreateFeatureAccumulator = (
  accumulatorByValue: Map<string, FeatureAccumulator>,
  value: string,
) => {
  const normalizedValue = normalizeFeatureKey(value)
  const existingAccumulator = accumulatorByValue.get(normalizedValue)
  if (existingAccumulator) {
    return existingAccumulator
  }

  const nextAccumulator: FeatureAccumulator = {
    positiveCount: 0,
    negativeCount: 0,
    neutralCount: 0,
  }
  accumulatorByValue.set(normalizedValue, nextAccumulator)
  return nextAccumulator
}

const accumulateFeature = (
  accumulatorByValue: Map<string, FeatureAccumulator>,
  value: string,
  signalType: AiTasteSignalType,
) => {
  const normalizedValue = normalizeTextValue(value)
  if (!normalizedValue) {
    return
  }

  const accumulator = getOrCreateFeatureAccumulator(
    accumulatorByValue,
    normalizedValue,
  )
  const signalTone = getSignalTone(signalType)

  if (signalTone === 'positive') {
    accumulator.positiveCount += 1
  } else if (signalTone === 'negative') {
    accumulator.negativeCount += 1
  } else {
    accumulator.neutralCount += 1
  }
}

const convertFeatureStats = (
  accumulatorByValue: Map<string, FeatureAccumulator>,
): AiTasteFeatureStat[] => {
  return Array.from(accumulatorByValue.entries())
    .map(([value, accumulator]) => ({
      value,
      positiveCount: accumulator.positiveCount,
      negativeCount: accumulator.negativeCount,
      neutralCount: accumulator.neutralCount,
      totalCount:
        accumulator.positiveCount +
        accumulator.negativeCount +
        accumulator.neutralCount,
    }))
    .sort((firstStat, secondStat) => {
      if (secondStat.totalCount !== firstStat.totalCount) {
        return secondStat.totalCount - firstStat.totalCount
      }

      return firstStat.value.localeCompare(secondStat.value)
    })
}

const pickDirectionalFeatureStats = (
  featureStats: AiTasteFeatureStat[],
  direction: 'positive' | 'negative',
  limit = 8,
) => {
  return [...featureStats]
    .filter((featureStat) =>
      direction === 'positive'
        ? featureStat.positiveCount > featureStat.negativeCount
        : featureStat.negativeCount > featureStat.positiveCount,
    )
    .sort((firstStat, secondStat) => {
      const firstDelta =
        direction === 'positive'
          ? firstStat.positiveCount - firstStat.negativeCount
          : firstStat.negativeCount - firstStat.positiveCount
      const secondDelta =
        direction === 'positive'
          ? secondStat.positiveCount - secondStat.negativeCount
          : secondStat.negativeCount - secondStat.positiveCount

      if (secondDelta !== firstDelta) {
        return secondDelta - firstDelta
      }

      if (secondStat.totalCount !== firstStat.totalCount) {
        return secondStat.totalCount - firstStat.totalCount
      }

      return firstStat.value.localeCompare(secondStat.value)
    })
    .slice(0, limit)
}

const buildAiTasteSampleStats = (
  gameItems: AiTasteGameItem[],
  featureStats: AiTasteSampleFile['featureStats'],
): AiTasteSampleStats => {
  const likedGamesCount = gameItems.filter(
    (gameItem) => gameItem.signal === 'playedFavorite',
  ).length
  const bookmarkedGamesCount = gameItems.filter(
    (gameItem) => gameItem.signal === 'favorite',
  ).length
  const dislikedGamesCount = gameItems.filter(
    (gameItem) => gameItem.signal === 'playedDisliked',
  ).length
  const trashGamesCount = gameItems.filter(
    (gameItem) => gameItem.signal === 'trash',
  ).length
  const neutralPlayedGamesCount = gameItems.filter(
    (gameItem) => gameItem.signal === 'played',
  ).length
  const allFeatureStats = [
    ...featureStats.tags,
    ...featureStats.prefixes,
    ...featureStats.creators,
  ]

  return {
    totalGamesCount: gameItems.length,
    likedGamesCount,
    dislikedGamesCount,
    neutralPlayedGamesCount,
    bookmarkedGamesCount,
    trashGamesCount,
    topPositiveFeatures: pickDirectionalFeatureStats(allFeatureStats, 'positive'),
    topNegativeFeatures: pickDirectionalFeatureStats(allFeatureStats, 'negative'),
  }
}

const buildFeatureStats = (gameItems: AiTasteGameItem[]) => {
  const tagAccumulatorByValue = new Map<string, FeatureAccumulator>()
  const prefixAccumulatorByValue = new Map<string, FeatureAccumulator>()
  const creatorAccumulatorByValue = new Map<string, FeatureAccumulator>()

  for (const gameItem of gameItems) {
    for (const tag of gameItem.tags) {
      accumulateFeature(tagAccumulatorByValue, tag, gameItem.signal)
    }
    for (const prefix of gameItem.prefixes) {
      accumulateFeature(prefixAccumulatorByValue, prefix, gameItem.signal)
    }
    accumulateFeature(creatorAccumulatorByValue, gameItem.creator, gameItem.signal)
  }

  return {
    tags: convertFeatureStats(tagAccumulatorByValue),
    prefixes: convertFeatureStats(prefixAccumulatorByValue),
    creators: convertFeatureStats(creatorAccumulatorByValue),
  }
}

const buildAiTasteSampleFile = (
  sessionState: SessionState,
  tagsMap: Record<string, string>,
  prefixesMap: Record<string, string>,
  sampleMode: AiTasteSampleMode,
): AiTasteSampleFile => {
  const sourceSnapshot = buildAiTasteSourceSnapshot(sessionState)
  const allGameItems = Object.entries(sourceSnapshot.signalByLink)
    .map(([threadLink, signalType]) =>
      buildAiTasteGameItem(threadLink, signalType, sessionState, tagsMap, prefixesMap),
    )
    .filter((gameItem): gameItem is AiTasteGameItem => Boolean(gameItem))
  const likedGames = allGameItems.filter(
    (gameItem) => gameItem.signal === 'playedFavorite',
  )
  const bookmarkedGames = allGameItems.filter(
    (gameItem) => gameItem.signal === 'favorite',
  )
  const dislikedGames = allGameItems.filter(
    (gameItem) => gameItem.signal === 'playedDisliked',
  )
  const trashGames = allGameItems.filter((gameItem) => gameItem.signal === 'trash')
  const neutralPlayedGames = allGameItems.filter(
    (gameItem) => gameItem.signal === 'played',
  )
  const sampledLikedGames = limitGameItems(
    likedGames,
    sampleMode,
    BEST_SAMPLE_POSITIVE_LIMIT,
  )
  const sampledBookmarkedGames = limitGameItems(
    bookmarkedGames,
    sampleMode,
    BEST_SAMPLE_POSITIVE_LIMIT,
  )
  const sampledDislikedGames = limitGameItems(
    dislikedGames,
    sampleMode,
    BEST_SAMPLE_NEGATIVE_LIMIT,
  )
  const sampledTrashGames = limitGameItems(
    trashGames,
    sampleMode,
    BEST_SAMPLE_NEGATIVE_LIMIT,
  )
  const sampledNeutralPlayedGames = limitGameItems(
    neutralPlayedGames,
    sampleMode,
    BEST_SAMPLE_NEUTRAL_LIMIT,
  )
  const sampledGameItems = [
    ...sampledLikedGames,
    ...sampledBookmarkedGames,
    ...sampledDislikedGames,
    ...sampledTrashGames,
    ...sampledNeutralPlayedGames,
  ]

  const featureStats = buildFeatureStats(sampledGameItems)

  return {
    format: AI_TASTE_SAMPLE_FORMAT,
    exportedAtUnixMs: Date.now(),
    sampleMode,
    sourceSnapshot,
    dictionaries: {
      tagsById: normalizeLookupMap(tagsMap),
      prefixesById: normalizeLookupMap(prefixesMap),
    },
    userSignals: {
      likedGames: sampledLikedGames,
      dislikedGames: sampledDislikedGames,
      neutralPlayedGames: sampledNeutralPlayedGames,
      bookmarkedGames: sampledBookmarkedGames,
      trashGames: sampledTrashGames,
    },
    featureStats,
    sampleStats: buildAiTasteSampleStats(sampledGameItems, featureStats),
  }
}

const buildAiTastePromptText = () => {
  return [
    'Проанализируй прикрепленный JSON-файл с моими игровыми предпочтениями.',
    '',
    'Твоя задача: составить профиль вкуса пользователя для приложения F95 Tinder.',
    'Профиль будет использоваться приложением как карта весов, а не как список конкретных игр.',
    '',
    'Важно:',
    '1. Не выбирай конкретные игры.',
    '2. Не придумывай новые теги, движки, авторов или признаки.',
    '3. Используй только данные из прикрепленного JSON-файла.',
    '4. Верни результат строго в формате JSON.',
    '5. Лучше верни JSON как файл с названием f95-tinder-ai-taste-profile.json.',
    '6. Никакого markdown и текста вне JSON.',
    '7. weight должен быть числом от -3 до 3.',
    '8. confidence должен быть числом от 0 до 1.',
    '9. Чем меньше данных по признаку, тем ниже confidence.',
    '10. reason пиши коротко на русском и понятно для человека.',
    '11. Не используй абстрактные фразы без названия признака, например "признак чаще в плюсе".',
    '12. В reason объясняй смысл: "часто встречается в любимых", "часто встречается в мусоре", "слабый сигнал".',
    '13. sourceSnapshot скопируй из входного файла без изменений.',
    '14. createdAtUnixMs поставь текущим временем в миллисекундах.',
    '15. shortStats сделай короткой статистикой для дашборда: что больше всего нравится, что чаще отталкивает, и как использовать профиль.',
    '16. shortStats.positiveHighlights и shortStats.negativeHighlights должны быть готовыми фразами для пользователя, не сырыми счетчиками.',
    '17. В shortStats не пиши пункты вида "Признак чаще в плюсе: 240/756". Лучше: "Чаще всего тянут вверх: 3d game, kinetic novel, bdsm".',
    '18. summary сделай понятным одним предложением, без длинного полотна.',
    '19. В reason для tagWeights, prefixWeights, creatorWeights и combinationRules лучше писать простой смысл: "нравится", "не нравится", "скорее нравится", "скорее не нравится".',
    '20. Не пиши в reason сырые счетчики вида "Положительных: 243, отрицательных: 759".',
    '',
    'Формат ответа:',
    '{',
    '  "format": "f95-tinder-ai-taste-profile-v1",',
    '  "createdAtUnixMs": 0,',
    '  "sourceSnapshot": {},',
    '  "summary": "string",',
    '  "shortStats": {',
    '    "overview": "string",',
    '    "positiveHighlights": ["string"],',
    '    "negativeHighlights": ["string"],',
    '    "recommendationStrategy": "string"',
    '  },',
    '  "tagWeights": [',
    '    {',
    '      "value": "string",',
    '      "weight": 0,',
    '      "confidence": 0,',
    '      "reason": "string"',
    '    }',
    '  ],',
    '  "prefixWeights": [',
    '    {',
    '      "value": "string",',
    '      "weight": 0,',
    '      "confidence": 0,',
    '      "reason": "string"',
    '    }',
    '  ],',
    '  "creatorWeights": [',
    '    {',
    '      "value": "string",',
    '      "weight": 0,',
    '      "confidence": 0,',
    '      "reason": "string"',
    '    }',
    '  ],',
    '  "combinationRules": [',
    '    {',
    '      "values": ["string"],',
    '      "weight": 0,',
    '      "confidence": 0,',
    '      "reason": "string"',
    '    }',
    '  ]',
    '}',
  ].join('\n')
}

const normalizeSignalType = (value: unknown): AiTasteSignalType | null => {
  if (
    value === 'playedFavorite' ||
    value === 'playedDisliked' ||
    value === 'played' ||
    value === 'favorite' ||
    value === 'trash'
  ) {
    return value
  }

  return null
}

const normalizeSourceSnapshot = (value: unknown): AiTasteSourceSnapshot | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  const rawSnapshot = value as Record<string, unknown>
  const rawSignalByLink = rawSnapshot.signalByLink
  if (!rawSignalByLink || typeof rawSignalByLink !== 'object' || Array.isArray(rawSignalByLink)) {
    return null
  }

  const signalByLink: Record<string, AiTasteSignalType> = {}
  for (const [threadLink, rawSignalType] of Object.entries(rawSignalByLink)) {
    const signalType = normalizeSignalType(rawSignalType)
    if (threadLink && signalType) {
      signalByLink[threadLink] = signalType
    }
  }

  let positiveSignalsCount = 0
  let negativeSignalsCount = 0
  let neutralSignalsCount = 0

  for (const signalType of Object.values(signalByLink)) {
    const signalTone = getSignalTone(signalType)
    if (signalTone === 'positive') {
      positiveSignalsCount += 1
    } else if (signalTone === 'negative') {
      negativeSignalsCount += 1
    } else {
      neutralSignalsCount += 1
    }
  }

  return {
    trackedSignalsCount: Object.keys(signalByLink).length,
    positiveSignalsCount,
    negativeSignalsCount,
    neutralSignalsCount,
    signalByLink,
  }
}

const normalizeFeatureWeight = (value: unknown): AiTasteFeatureWeight | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  const rawWeight = value as Record<string, unknown>
  const normalizedValue = normalizeTextValue(rawWeight.value)
  if (!normalizedValue) {
    return null
  }

  return {
    value: normalizedValue,
    weight: clamp(normalizeFiniteNumber(rawWeight.weight), -3, 3),
    confidence: clamp(normalizeFiniteNumber(rawWeight.confidence), 0, 1),
    reason: normalizeTextValue(rawWeight.reason),
  }
}

const normalizeFeatureWeightList = (value: unknown) => {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map(normalizeFeatureWeight)
    .filter((item): item is AiTasteFeatureWeight => Boolean(item))
}

const normalizeCombinationRule = (value: unknown): AiTasteCombinationRule | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  const rawRule = value as Record<string, unknown>
  const values = Array.isArray(rawRule.values)
    ? Array.from(
        new Set(
          rawRule.values
            .map(normalizeTextValue)
            .filter((itemValue) => itemValue.length > 0),
        ),
      )
    : []

  if (values.length === 0) {
    return null
  }

  return {
    values,
    weight: clamp(normalizeFiniteNumber(rawRule.weight), -3, 3),
    confidence: clamp(normalizeFiniteNumber(rawRule.confidence), 0, 1),
    reason: normalizeTextValue(rawRule.reason),
  }
}

const normalizeCombinationRuleList = (value: unknown) => {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map(normalizeCombinationRule)
    .filter((item): item is AiTasteCombinationRule => Boolean(item))
}

const normalizeStringList = (value: unknown, limit = 8) => {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map(normalizeTextValue)
    .filter((itemValue) => itemValue.length > 0)
    .slice(0, limit)
}

const normalizeShortStats = (value: unknown): AiTasteShortStats | undefined => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined
  }

  const rawShortStats = value as Record<string, unknown>
  const overview = normalizeTextValue(rawShortStats.overview)
  const positiveHighlights = normalizeStringList(rawShortStats.positiveHighlights)
  const negativeHighlights = normalizeStringList(rawShortStats.negativeHighlights)
  const recommendationStrategy = normalizeTextValue(
    rawShortStats.recommendationStrategy,
  )

  if (
    !overview &&
    positiveHighlights.length === 0 &&
    negativeHighlights.length === 0 &&
    !recommendationStrategy
  ) {
    return undefined
  }

  return {
    overview,
    positiveHighlights,
    negativeHighlights,
    recommendationStrategy,
  }
}

const parseAiTasteProfileValue = (value: unknown): AiTasteProfileFile | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  const rawProfile = value as Record<string, unknown>
  if (rawProfile.format !== AI_TASTE_PROFILE_FORMAT) {
    return null
  }

  const sourceSnapshot = normalizeSourceSnapshot(rawProfile.sourceSnapshot)
  if (!sourceSnapshot) {
    return null
  }

  return {
    format: AI_TASTE_PROFILE_FORMAT,
    createdAtUnixMs: normalizeIntegerUnixMs(rawProfile.createdAtUnixMs),
    sourceSnapshot,
    summary: normalizeTextValue(rawProfile.summary),
    shortStats: normalizeShortStats(rawProfile.shortStats),
    tagWeights: normalizeFeatureWeightList(rawProfile.tagWeights),
    prefixWeights: normalizeFeatureWeightList(rawProfile.prefixWeights),
    creatorWeights: normalizeFeatureWeightList(rawProfile.creatorWeights),
    combinationRules: normalizeCombinationRuleList(rawProfile.combinationRules),
  }
}

const parseAiTasteProfileJson = (jsonText: string) => {
  const parsedValue = safeJsonParse<unknown>(jsonText)
  return parseAiTasteProfileValue(parsedValue)
}

const buildFeatureWeightMap = (featureWeights: AiTasteFeatureWeight[]) => {
  const weightMap = new Map<string, AiTasteFeatureWeight>()

  for (const featureWeight of featureWeights) {
    weightMap.set(normalizeFeatureKey(featureWeight.value), featureWeight)
  }

  return weightMap
}

const createAiContribution = (
  featureWeight: AiTasteFeatureWeight | AiTasteCombinationRule,
) => {
  return featureWeight.weight * featureWeight.confidence
}

const getCandidateFeatureValues = (
  candidate: AiTasteCandidate,
  tagsMap: Record<string, string>,
  prefixesMap: Record<string, string>,
) => {
  const tagValues = normalizeNumberList(candidate.tags).map((tagId) =>
    getFeatureLabel(tagId, tagsMap),
  )
  const prefixValues = getEnginePrefixIdList(
    normalizeNumberList(candidate.prefixes),
  ).map((prefixId) => getFeatureLabel(prefixId, prefixesMap))
  const creatorValue = normalizeTextValue(candidate.creator)

  return {
    tagValues,
    prefixValues,
    creatorValue,
    allValues: [
      ...tagValues,
      ...prefixValues,
      ...(creatorValue ? [creatorValue] : []),
      candidate.rating >= 4 ? 'high rating' : '',
      candidate.rating > 0 && candidate.rating < 3 ? 'low rating' : '',
    ].filter(Boolean),
  }
}

const pushAiReason = (
  reasons: AiTasteReason[],
  text: string,
  contribution: number,
) => {
  if (!text || reasons.length >= MAX_AI_REASON_COUNT) {
    return
  }

  reasons.push({
    text,
    tone: contribution >= 0 ? 'positive' : 'negative',
  })
}

const getAiContributionMeaning = (contribution: number) => {
  if (contribution >= 0.45) {
    return 'нравится'
  }

  if (contribution > 0) {
    return 'скорее нравится'
  }

  if (contribution <= -0.45) {
    return 'не нравится'
  }

  return 'скорее не нравится'
}

const formatAiReasonText = (
  featureLabel: string,
  featureValue: string,
  contribution: number,
) => {
  const normalizedFeatureValue = normalizeTextValue(featureValue)
  const featurePrefix = normalizedFeatureValue
    ? `${featureLabel}: ${normalizedFeatureValue}`
    : featureLabel

  return `${featurePrefix} · ${getAiContributionMeaning(contribution)}`
}


const assessThreadAiTaste = (
  candidate: AiTasteCandidate | null,
  profile: AiTasteProfileFile | null,
  tagsMap: Record<string, string>,
  prefixesMap: Record<string, string>,
): AiTasteAssessment | null => {
  if (!candidate || !profile) {
    return null
  }

  const tagWeightMap = buildFeatureWeightMap(profile.tagWeights)
  const prefixWeightMap = buildFeatureWeightMap(profile.prefixWeights)
  const creatorWeightMap = buildFeatureWeightMap(profile.creatorWeights)
  const candidateFeatureValues = getCandidateFeatureValues(
    candidate,
    tagsMap,
    prefixesMap,
  )
  const reasons: AiTasteReason[] = []
  let rawScore = 0
  let confidenceTotal = 0
  let contributionCount = 0

  for (const tagValue of candidateFeatureValues.tagValues) {
    const featureWeight = tagWeightMap.get(normalizeFeatureKey(tagValue))
    if (!featureWeight) {
      continue
    }

    const contribution = createAiContribution(featureWeight)
    rawScore += contribution
    confidenceTotal += featureWeight.confidence
    contributionCount += 1
    pushAiReason(
      reasons,
      formatAiReasonText('Тег', tagValue, contribution),
      contribution,
    )
  }

  for (const prefixValue of candidateFeatureValues.prefixValues) {
    const featureWeight = prefixWeightMap.get(normalizeFeatureKey(prefixValue))
    if (!featureWeight) {
      continue
    }

    const contribution = createAiContribution(featureWeight)
    rawScore += contribution
    confidenceTotal += featureWeight.confidence
    contributionCount += 1
    pushAiReason(
      reasons,
      formatAiReasonText('Движок', prefixValue, contribution),
      contribution,
    )
  }

  if (candidateFeatureValues.creatorValue) {
    const featureWeight = creatorWeightMap.get(
      normalizeFeatureKey(candidateFeatureValues.creatorValue),
    )
    if (featureWeight) {
      const contribution = createAiContribution(featureWeight)
      rawScore += contribution
      confidenceTotal += featureWeight.confidence
      contributionCount += 1
      pushAiReason(
        reasons,
        formatAiReasonText(
          'Автор',
          candidateFeatureValues.creatorValue,
          contribution,
        ),
        contribution,
      )
    }
  }

  const normalizedCandidateFeatureValueSet = new Set(
    candidateFeatureValues.allValues.map(normalizeFeatureKey),
  )

  for (const combinationRule of profile.combinationRules) {
    const hasAllValues = combinationRule.values.every((value) =>
      normalizedCandidateFeatureValueSet.has(normalizeFeatureKey(value)),
    )
    if (!hasAllValues) {
      continue
    }

    const contribution = createAiContribution(combinationRule)
    rawScore += contribution
    confidenceTotal += combinationRule.confidence
    contributionCount += 1
    pushAiReason(
      reasons,
      formatAiReasonText(
        'Сочетание',
        combinationRule.values.join(' + '),
        contribution,
      ),
      contribution,
    )
  }

  const clampedRawScore = clamp(
    rawScore,
    -MAX_AI_RAW_SCORE_MAGNITUDE,
    MAX_AI_RAW_SCORE_MAGNITUDE,
  )
  const score = Math.round((Math.tanh(clampedRawScore / 3) + 1) * 50)
  const confidence = contributionCount > 0 ? confidenceTotal / contributionCount : 0

  return {
    score: clamp(score, 0, 100),
    rawScore: clampedRawScore,
    confidence: clamp(confidence, 0, 1),
    reasons,
    summary:
      reasons.length > 0
        ? reasons.map((reason) => reason.text).join(' • ')
        : 'ИИ-профиль не нашел явных совпадений.',
  }
}

const calculateAiTasteInfluencePercent = (
  aiFreshnessPercent: number | null | undefined,
  isAiTasteEnabled = true,
) => {
  if (
    !isAiTasteEnabled ||
    typeof aiFreshnessPercent !== 'number' ||
    !Number.isFinite(aiFreshnessPercent) ||
    aiFreshnessPercent <= 0
  ) {
    return 0
  }

  return MAX_AI_INFLUENCE * clamp(aiFreshnessPercent / 100, 0, 1)
}

const combineAppAndAiInterestScore = (
  appScore: number,
  aiScore: number | null | undefined,
  aiFreshnessPercent: number | null | undefined,
  isAiTasteEnabled = true,
) => {
  if (
    !isAiTasteEnabled ||
    typeof aiScore !== 'number' ||
    !Number.isFinite(aiScore)
  ) {
    return Math.round(clamp(appScore, 0, 100))
  }

  const aiInfluence = calculateAiTasteInfluencePercent(
    aiFreshnessPercent,
    isAiTasteEnabled,
  )
  if (aiInfluence <= 0) {
    return Math.round(clamp(appScore, 0, 100))
  }

  const combinedScore = appScore * (1 - aiInfluence) + aiScore * aiInfluence

  return Math.round(clamp(combinedScore, 0, 100))
}

export {
  AI_TASTE_PROFILE_FORMAT,
  AI_TASTE_SAMPLE_FORMAT,
  assessThreadAiTaste,
  buildAiTastePromptText,
  buildAiTasteSampleFile,
  buildAiTasteSourceSnapshot,
  calculateAiTasteFreshness,
  calculateAiTasteInfluencePercent,
  combineAppAndAiInterestScore,
  parseAiTasteProfileJson,
  parseAiTasteProfileValue,
}

export type {
  AiTasteAssessment,
  AiTasteFeatureWeight,
  AiTasteFreshness,
  AiTasteProfileFile,
  AiTasteSampleFile,
  AiTasteShortStats,
  AiTasteSampleMode,
  AiTasteSignalType,
  AiTasteSourceSnapshot,
}
