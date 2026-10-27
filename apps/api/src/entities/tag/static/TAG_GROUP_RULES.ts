import { ETagKey } from "../schemas/ETagKey"
import { EItemType } from "@entities/item/schemas/EItemType"
import { EAgeRestriction } from "@entities/item/schemas/EAgeRestriction"
import { EUnit } from "@entities/shared/schemas/EUnit"
import { ETagGroup } from "../schemas/ETagGroup"
import type { TTagGroupRule } from "../types/TTagGroupRule"

const TAG_GROUP_RULES = {
  [ETagGroup.GENRE]: {
    kind: "dictionary",
    itemTypes: Object.values(EItemType),
    cardinality: "many",
    isUsedForTaste: true,
    isApprovalRequired: true,
    description:
      "Жанры; совпадающие названия с разным смыслом остаются отдельными понятиями",
  },
  [ETagGroup.SUBGENRE]: {
    kind: "dictionary",
    itemTypes: Object.values(EItemType),
    cardinality: "many",
    isUsedForTaste: true,
    isApprovalRequired: true,
    description:
      "Поджанры со связями с родительскими жанрами; родители не назначаются автоматически и не учитываются как независимые подтверждения вкуса",
  },
  [ETagGroup.KEYWORD]: {
    kind: "dictionary",
    itemTypes: Object.values(EItemType),
    cardinality: "many",
    isUsedForTaste: true,
    isApprovalRequired: true,
    description:
      "Темы, мотивы и содержательные признаки, кроме игровых механик",
  },
  [ETagGroup.FORMAT]: {
    kind: "dictionary",
    itemTypes: Object.values(EItemType),
    cardinality: "many",
    isUsedForTaste: true,
    isApprovalRequired: true,
    description: "Форматы произведений без дублирования Item.type",
  },
  [ETagGroup.STYLE]: {
    kind: "dictionary",
    itemTypes: Object.values(EItemType),
    cardinality: "many",
    isUsedForTaste: true,
    isApprovalRequired: true,
    description: "Атмосфера, темп, стиль повествования и визуальные техники",
  },
  [ETagGroup.AUDIENCE]: {
    kind: "dictionary",
    itemTypes: Object.values(EItemType),
    cardinality: "many",
    isUsedForTaste: false,
    isApprovalRequired: true,
    description:
      "Целевая аудитория; не заменяет возрастные ограничения и не выводится из них",
  },
  [ETagGroup.COUNTRY]: {
    kind: "dictionary",
    itemTypes: Object.values(EItemType),
    cardinality: "many",
    isUsedForTaste: false,
    isApprovalRequired: true,
    description:
      "Страны производства, кроме регионов, городов и вымышленных стран",
  },
  [ETagGroup.ORIGINAL_LANGUAGE]: {
    kind: "dictionary",
    itemTypes: Object.values(EItemType),
    cardinality: "many",
    isUsedForTaste: false,
    isApprovalRequired: true,
    description: "Только языки оригинала, без языков перевода",
  },
  [ETagGroup.PLATFORM]: {
    kind: "dictionary",
    itemTypes: [EItemType.GAME],
    cardinality: "many",
    isUsedForTaste: false,
    isApprovalRequired: true,
    description:
      "Доступные игровые платформы, кроме магазинов и устройств пользователя; порты используют общий Item",
  },
  [ETagGroup.DURATION]: {
    kind: "range",
    itemTypes: [
      EItemType.MOVIE,
      EItemType.ANIMATED_MOVIE,
      EItemType.ANIME_MOVIE,
    ],
    cardinality: "one",
    isUsedForTaste: true,
    isApprovalRequired: true,
    description:
      "Длительность фильма по точному положительному значению в минутах",
    sourceField: "movie.duration",
    unit: EUnit.MINUTE,
    bounds: "[)",
    ranges: [
      { key: "duration0To30", from: 0, to: 30 },
      { key: "duration30To60", from: 30, to: 60 },
      { key: "duration60To90", from: 60, to: 90 },
      { key: "duration90To120", from: 90, to: 120 },
      { key: "duration120To150", from: 120, to: 150 },
      { key: "duration150To180", from: 150, to: 180 },
      { key: "duration180Plus", from: 180, to: null },
    ],
  },
  [ETagGroup.EPISODE_DURATION]: {
    kind: "range",
    itemTypes: [
      EItemType.SERIES,
      EItemType.ANIMATED_SERIES,
      EItemType.ANIME_SERIES,
    ],
    cardinality: "one",
    isUsedForTaste: true,
    isApprovalRequired: true,
    description:
      "Ориентировочная длительность обычной серии по положительному значению в минутах",
    sourceField: "series.episodeDuration",
    unit: EUnit.MINUTE,
    bounds: "[)",
    ranges: [
      { key: "episodeDuration0To10", from: 0, to: 10 },
      { key: "episodeDuration10To25", from: 10, to: 25 },
      { key: "episodeDuration25To60", from: 25, to: 60 },
      { key: "episodeDuration60To90", from: 60, to: 90 },
      { key: "episodeDuration90To120", from: 90, to: 120 },
      { key: "episodeDuration120Plus", from: 120, to: null },
    ],
  },
  [ETagGroup.EPISODE_COUNT]: {
    kind: "range",
    itemTypes: [
      EItemType.SERIES,
      EItemType.ANIMATED_SERIES,
      EItemType.ANIME_SERIES,
    ],
    cardinality: "one",
    isUsedForTaste: false,
    isApprovalRequired: true,
    description:
      "Общее количество серий сезона по положительному целому значению",
    sourceField: "series.episodeCount",
    unit: EUnit.EPISODE,
    bounds: "[)",
    ranges: [
      { key: "episodeCount1To7", from: 1, to: 7 },
      { key: "episodeCount7To14", from: 7, to: 14 },
      { key: "episodeCount14To27", from: 14, to: 27 },
      { key: "episodeCount27To53", from: 27, to: 53 },
      { key: "episodeCount53To101", from: 53, to: 101 },
      { key: "episodeCount101Plus", from: 101, to: null },
    ],
  },
  [ETagGroup.MAIN_STORY_DURATION]: {
    kind: "range",
    itemTypes: [EItemType.GAME],
    cardinality: "one",
    isUsedForTaste: true,
    isApprovalRequired: true,
    description:
      "Оценка времени прохождения основной истории базовой игры в минутах, без DLC",
    sourceField: "game.mainStoryDuration",
    isDefinedEndRequired: true,
    unit: EUnit.MINUTE,
    bounds: "[)",
    ranges: [
      { key: "mainStoryDuration0To120", from: 0, to: 120 },
      { key: "mainStoryDuration120To300", from: 120, to: 300 },
      { key: "mainStoryDuration300To600", from: 300, to: 600 },
      { key: "mainStoryDuration600To1200", from: 600, to: 1200 },
      { key: "mainStoryDuration1200To2400", from: 1200, to: 2400 },
      { key: "mainStoryDuration2400To4800", from: 2400, to: 4800 },
      { key: "mainStoryDuration4800Plus", from: 4800, to: null },
    ],
  },
  [ETagGroup.FULL_COMPLETION_DURATION]: {
    kind: "range",
    itemTypes: [EItemType.GAME],
    cardinality: "one",
    isUsedForTaste: true,
    isApprovalRequired: true,
    description:
      "Оценка времени полного прохождения базовой игры в минутах, включая необязательный контент, но без DLC",
    sourceField: "game.fullCompletionDuration",
    isDefinedEndRequired: true,
    unit: EUnit.MINUTE,
    bounds: "[)",
    ranges: [
      { key: "fullCompletionDuration0To300", from: 0, to: 300 },
      { key: "fullCompletionDuration300To600", from: 300, to: 600 },
      { key: "fullCompletionDuration600To1200", from: 600, to: 1200 },
      { key: "fullCompletionDuration1200To2400", from: 1200, to: 2400 },
      { key: "fullCompletionDuration2400To4800", from: 2400, to: 4800 },
      { key: "fullCompletionDuration4800To9000", from: 4800, to: 9000 },
      { key: "fullCompletionDuration9000Plus", from: 9000, to: null },
    ],
  },
  [ETagGroup.GAME_LENGTH]: {
    kind: "dictionary",
    itemTypes: [EItemType.GAME],
    cardinality: "one",
    isUsedForTaste: false,
    isApprovalRequired: true,
    values: ["shortGame", "longGame"],
    description:
      "Оценка длины игры как короткой или длинной по данным источника, без фиксированных порогов времени прохождения",
  },
  [ETagGroup.RELEASE_STATUS]: {
    kind: "enum",
    itemTypes: Object.values(EItemType),
    cardinality: "one",
    isUsedForTaste: false,
    isApprovalRequired: true,
    values: [
      { key: ETagKey.RELEASE_STATUS_ANNOUNCED, value: "announced" },
      { key: ETagKey.RELEASE_STATUS_ONGOING, value: "ongoing" },
      { key: "releaseStatusReleased", value: "released" },
      { key: "releaseStatusCancelled", value: "cancelled" },
    ],
    description:
      "Состояние выпуска произведения или сезона; обновления выпущенной игры не означают продолжающийся выпуск",
  },
  [ETagGroup.HAS_DEFINED_END]: {
    kind: "enum",
    itemTypes: [EItemType.GAME],
    cardinality: "one",
    isUsedForTaste: false,
    isApprovalRequired: true,
    values: [
      { key: "hasDefinedEndTrue", value: true },
      { key: ETagKey.HAS_DEFINED_END_FALSE, value: false },
    ],
    description: "Наличие предусмотренного конечного прохождения базовой игры",
  },
  [ETagGroup.AGE_RESTRICTION]: {
    kind: "enum",
    itemTypes: Object.values(EItemType),
    cardinality: "one",
    isUsedForTaste: false,
    isApprovalRequired: true,
    values: Object.values(EAgeRestriction).map((value) => ({
      key:
        value === EAgeRestriction.AGE_18_PLUS_PLUS
          ? "ageRestriction18PlusPlus"
          : `ageRestriction${value}`,
      value,
    })),
    sourceField: "ageRestriction",
    description:
      "Нормализованное возрастное ограничение; 18++ только для порнографических игр, не по одному внешнему рейтингу; преобразование ESRB и PEGI требует отдельно согласованной таблицы соответствий",
  },
  [ETagGroup.RELEASE_YEAR]: {
    kind: "integer",
    itemTypes: Object.values(EItemType),
    cardinality: "one",
    isUsedForTaste: false,
    isApprovalRequired: true,
    min: 1,
    max: 9999,
    sourceField: "releaseDate",
    isYearWithoutDateAllowed: true,
    ranges: [
      { key: "releaseYear1To1930", from: 1, to: 1930 },
      { key: "releaseYear1930To1950", from: 1930, to: 1950 },
      { key: "releaseYear1950To1980", from: 1950, to: 1980 },
      { key: "releaseYear1980To1990", from: 1980, to: 1990 },
    ],
    description:
      "Год первого выпуска, включая будущие годы; диапазоны до 1990 года включают нижнюю и исключают верхнюю границу; известная точная дата имеет приоритет над тегом с отдельно указанным годом",
  },
  [ETagGroup.GAME_MODE]: {
    kind: "dictionary",
    itemTypes: [EItemType.GAME],
    cardinality: "many",
    isUsedForTaste: true,
    isApprovalRequired: true,
    values: [
      "singlePlayer",
      "cooperativeMultiplayer",
      "competitiveMultiplayer",
      "multiplayer",
      "playerVsEnvironment",
      "splitScreen",
    ],
    description:
      "Режимы игры; сотрудничество, соперничество, игра против окружения и разделение экрана описываются отдельно",
  },
  [ETagGroup.GAME_MECHANIC]: {
    kind: "dictionary",
    itemTypes: [EItemType.GAME],
    cardinality: "many",
    isUsedForTaste: true,
    isApprovalRequired: true,
    description: "Игровые действия и системы, отдельно от сюжетных тем",
  },
  [ETagGroup.PERSPECTIVE]: {
    kind: "dictionary",
    itemTypes: [EItemType.GAME],
    cardinality: "many",
    isUsedForTaste: true,
    isApprovalRequired: true,
    values: [
      "firstPerson",
      "thirdPerson",
      "topDown",
      "sideView",
      "isometric",
      "fixedCamera",
    ],
    description: "Ракурсы камеры; VR не является ракурсом камеры",
  },
} satisfies Record<ETagGroup, TTagGroupRule>

export { TAG_GROUP_RULES }
