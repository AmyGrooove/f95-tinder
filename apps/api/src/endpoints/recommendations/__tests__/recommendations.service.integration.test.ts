import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "@jest/globals"
import { getModelToken } from "@nestjs/mongoose"
import { Test, type TestingModule } from "@nestjs/testing"
import { Types } from "mongoose"

import {
  Collection,
  CollectionSchema,
} from "@entities/collection/schemas/collection.schema"
import { ECollectionBlockType } from "@entities/collection/schemas/ECollectionBlockType"
import { CollectionRepository } from "@entities/collection/services/collection.repository"
import { Item, ItemSchema } from "@entities/item/schemas/item.schema"
import { EItemField } from "@entities/item/schemas/EItemField"
import { EItemType } from "@entities/item/schemas/EItemType"
import { EAgeRestriction } from "@entities/item/schemas/EAgeRestriction"
import { ItemRepository } from "@entities/item/services/item.repository"
import type { IRecommendationLibrary } from "@entities/item/types/IRecommendationLibrary"
import { ETagGroup } from "@entities/tag/schemas/ETagGroup"
import { EUserItemStatus } from "@entities/userItem/schemas/EUserItemStatus"
import {
  UserItem,
  UserItemSchema,
} from "@entities/userItem/schemas/userItem.schema"
import {
  SiteStats,
  SiteStatsSchema,
} from "@entities/siteStats/schemas/siteStats.schema"
import {
  SiteRatingsStats,
  SiteRatingsStatsSchema,
} from "@entities/siteStats/schemas/siteRatingsStats.schema"
import { SiteRatingsStatsRepository } from "@entities/siteStats/services/siteRatingsStats.repository"
import { ESiteStatsKey } from "@entities/siteStats/schemas/ESiteStatsKey"
import {
  UserTasteProfile,
  UserTasteProfileSchema,
} from "@entities/userTasteProfile/schemas/userTasteProfile.schema"
import { UserTasteProfileRepository } from "@entities/userTasteProfile/services/userTasteProfile.repository"
import { getTestDatabase } from "@test/setup/setupDatabase"
import { isUndefined } from "@shared/functions/checks/isUndefined"
import { ECountry } from "@entities/shared/schemas/ECountry"

import { RecommendationsService } from "../services/recommendations.service"
import type { IFindRecommendationsProps } from "../types/IFindRecommendationsProps"

describe("RecommendationsService MongoDB", () => {
  let service: RecommendationsService
  let repository: ItemRepository
  let userId: Types.ObjectId
  let module: TestingModule

  beforeAll(async () => {
    const { connection } = getTestDatabase()
    const siteModel = connection.model(SiteStats.name, SiteStatsSchema)
    const ratingsModel = siteModel.discriminator(
      SiteRatingsStats.name,
      SiteRatingsStatsSchema,
      ESiteStatsKey.RATINGS,
    )
    module = await Test.createTestingModule({
      providers: [
        RecommendationsService,
        SiteRatingsStatsRepository,
        {
          provide: getModelToken(SiteRatingsStats.name),
          useValue: ratingsModel,
        },
        ItemRepository,
        CollectionRepository,
        UserTasteProfileRepository,
        {
          provide: getModelToken(Item.name),
          useValue: connection.model(Item.name, ItemSchema),
        },
        {
          provide: getModelToken(Collection.name),
          useValue: connection.model(Collection.name, CollectionSchema),
        },
        {
          provide: getModelToken(UserItem.name),
          useValue: connection.model(UserItem.name, UserItemSchema),
        },
        {
          provide: getModelToken(UserTasteProfile.name),
          useValue: connection.model(
            UserTasteProfile.name,
            UserTasteProfileSchema,
          ),
        },
      ],
    }).compile()
    repository = module.get(ItemRepository)
    service = module.get(RecommendationsService)
    await Promise.all(
      Object.values(connection.models).map(async (model) => model.init()),
    )
  })

  beforeEach(() => {
    userId = new Types.ObjectId()
  })

  afterAll(async () => {
    await module?.close()
  })

  const seedItem = async (
    props: {
      id?: Types.ObjectId
      type?: EItemType
      deletedAt?: Date
      movie?: { duration?: number | null }
      game?: { mainStoryDuration?: number | null }
      ageRestriction?: EAgeRestriction
      releaseDate?: Date | null
    } = {},
  ) => {
    const { id = new Types.ObjectId(), ...fields } = props
    await getTestDatabase()
      .connection.collection("Item")
      .insertOne({
        _id: id,
        type: EItemType.GAME,
        title: { ru: "Произведение", en: null },
        media: [],
        deletedAt: null,
        ...fields,
      })
    return id
  }

  const seedTag = async (
    group: ETagGroup | null = ETagGroup.GENRE,
    weightModifier = 1,
    parents: Types.ObjectId[] = [],
  ) => {
    const tag = new Types.ObjectId()
    await getTestDatabase()
      .connection.collection("Tag")
      .insertOne({ _id: tag, group, weightModifier, parents })
    return tag
  }

  const assignTags = async (
    item: Types.ObjectId,
    tags: { tag: Types.ObjectId; relevanceScore?: number }[],
  ) => {
    await getTestDatabase()
      .connection.collection("TagItem")
      .insertMany(
        tags.map(({ tag, relevanceScore = 1 }) => ({
          item,
          tag,
          relevanceScore,
        })),
      )
  }

  const setProfile = async (
    preferences: {
      tag: Types.ObjectId
      weight?: number
      count?: number
      explicitWeight?: number
    }[],
  ) => {
    await getTestDatabase()
      .connection.collection("UserTasteProfile")
      .insertOne({
        user: userId,
        tagPreferences: preferences.map(
          ({ tag, weight = 0, count = 0, explicitWeight = 0 }) => ({
            tag,
            weight,
            count,
            explicitWeight,
          }),
        ),
      })
  }

  const react = async (props: {
    item: Types.ObjectId
    user?: Types.ObjectId
    status?: EUserItemStatus
    rating?: number | null
    isFavorite?: boolean
    expiresAt?: Date | null
  }) => {
    await getTestDatabase()
      .connection.collection("UserItem")
      .insertOne({
        user: userId,
        status: EUserItemStatus.PLANNED,
        rating: null,
        isFavorite: false,
        expiresAt: null,
        ...props,
      })
  }

  const find = async (
    props: Omit<IFindRecommendationsProps, "userId"> = {},
  ) => {
    return await service.find({ userId, ...props })
  }

  const link = async (props: {
    candidate: Types.ObjectId
    source: Types.ObjectId
    multiplier?: number
    isCandidateFirst?: boolean
  }) => {
    const candidateRole = new Types.ObjectId()
    const isCandidateFirst = props.isCandidateFirst ?? false
    await getTestDatabase()
      .connection.collection("Relation")
      .insertOne({
        _id: candidateRole,
        ...(isUndefined(props.multiplier)
          ? {}
          : { bonusMultiplier: props.multiplier }),
      })
    const candidate = { item: props.candidate, role: candidateRole }
    const source = { item: props.source, role: new Types.ObjectId() }
    await getTestDatabase()
      .connection.collection("ItemRelation")
      .insertOne({
        first: isCandidateFirst ? candidate : source,
        second: isCandidateFirst ? source : candidate,
      })
  }

  it("возвращает пустую страницу для пустого каталога", async () => {
    expect(await find()).toEqual({
      items: [],
      total: 0,
      page: 1,
      limit: 20,
      pages: 0,
      isNextPage: false,
      isPreviousPage: false,
    })
  })

  it("упорядочивает положительные, нейтральные и отрицательные совпадения без отсечения по вкусу", async () => {
    const liked = await seedTag()
    const disliked = await seedTag()
    const positive = await seedItem()
    const neutral = await seedItem()
    const negative = await seedItem()
    await setProfile([
      { tag: liked, explicitWeight: 0.8 },
      { tag: disliked, explicitWeight: -0.8 },
    ])
    await assignTags(positive, [{ tag: liked }])
    await assignTags(negative, [{ tag: disliked }])

    const result = await find()

    expect(result.items.map((item) => item._id)).toEqual([
      positive,
      neutral,
      negative,
    ])
    expect(result.items.map((item) => item.tasteScore)).toEqual([0.8, 0, -0.8])
    expect(result.items.map((item) => item.finalScore)).toEqual([1.4, 1, 0.6])
    expect(result.items.map((item) => item.ratingScore)).toEqual([
      5.5, 5.5, 5.5,
    ])
    expect(result.total).toBe(3)
    expect(Object.keys(result.items[0]).sort()).toEqual(
      [
        "_id",
        "type",
        "title",
        "media",
        "tasteScore",
        "baseScore",
        "plannedBoost",
        "relationBoost",
        "finalScore",
        "ratingScore",
      ].sort(),
    )
  })

  it.each([
    { count: 1, weight: 1, score: 1 / 6 },
    { count: 5, weight: 1, score: 0.5 },
    { count: 20, weight: 1, score: 0.8 },
    { count: 5, weight: -1, score: -0.5 },
  ])(
    "ослабляет рассчитанное предпочтение по уверенности: %j",
    async ({ count, weight, score }) => {
      const tag = await seedTag()
      const item = await seedItem()
      await setProfile([{ tag, weight, count }])
      await assignTags(item, [{ tag }])
      const result = await find()
      expect(result.items[0].tasteScore).toBeCloseTo(score, 12)
      const profile = await getTestDatabase()
        .connection.collection("UserTasteProfile")
        .findOne({ user: userId })
      expect(profile?.tagPreferences).toEqual([
        { tag, weight, count, explicitWeight: 0 },
      ])
    },
  )

  it.each([0, 1, 20])(
    "применяет явный выбор вместо противоположного рассчитанного веса при count=%i",
    async (count) => {
      const tag = await seedTag()
      const item = await seedItem()
      await setProfile([{ tag, weight: -1, count, explicitWeight: 0.8 }])
      await assignTags(item, [{ tag }])
      expect((await find()).items[0].tasteScore).toBeCloseTo(0.8, 12)
    },
  )

  it("учитывает выраженность только в числителе и относительную значимость в обеих суммах", async () => {
    const positive = await seedTag(ETagGroup.GENRE, 1)
    const negative = await seedTag(ETagGroup.KEYWORD, 3)
    const item = await seedItem()
    await setProfile([
      { tag: positive, weight: 0.9, count: 5 },
      { tag: negative, explicitWeight: -0.3 },
    ])
    await assignTags(item, [
      { tag: positive, relevanceScore: 0.4 },
      { tag: negative },
    ])
    expect((await find()).items[0].tasteScore).toBeCloseTo(-0.18, 12)
  })

  it("слабая выраженность ослабляет даже единственный знакомый тег", async () => {
    const tag = await seedTag(ETagGroup.GENRE, 2)
    const item = await seedItem()
    await setProfile([{ tag, explicitWeight: 1 }])
    await assignTags(item, [{ tag, relevanceScore: 0.2 }])
    expect((await find()).items[0].tasteScore).toBeCloseTo(0.2, 12)
  })

  it("не повышает балл за количество одинаково подходящих тегов и не учитывает неизвестные", async () => {
    const tags = await Promise.all(
      Array.from({ length: 12 }, async () => seedTag()),
    )
    const few = await seedItem()
    const many = await seedItem()
    await setProfile(
      tags.slice(0, 10).map((tag) => ({ tag, explicitWeight: 0.6 })),
    )
    await assignTags(few, [
      { tag: tags[0] },
      { tag: tags[10] },
      { tag: tags[11] },
    ])
    await assignTags(
      many,
      tags.slice(0, 10).map((tag) => ({ tag })),
    )
    const result = await find()
    expect(result.items).toHaveLength(2)
    for (const item of result.items) {
      expect(item.tasteScore).toBeCloseTo(0.6, 12)
      expect(item.finalScore).toBe(1.3)
    }
  })

  it("учитывает известный нулевой вес в знаменателе", async () => {
    const positive = await seedTag()
    const neutral = await seedTag()
    const item = await seedItem()
    await setProfile([
      { tag: positive, explicitWeight: 1 },
      { tag: neutral, weight: 0, count: 1 },
    ])
    await assignTags(item, [{ tag: positive }, { tag: neutral }])
    expect((await find()).items[0].tasteScore).toBe(0.5)
  })

  it("усредняет все теги вместе, а не выделяет доли группам", async () => {
    const first = await seedTag(ETagGroup.GENRE)
    const second = await seedTag(ETagGroup.GENRE)
    const duration = await seedTag(ETagGroup.MAIN_STORY_DURATION)
    const item = await seedItem()
    await setProfile([
      { tag: first, explicitWeight: 0.8 },
      { tag: second, explicitWeight: 0.8 },
      { tag: duration, explicitWeight: -0.4 },
    ])
    await assignTags(item, [{ tag: first }, { tag: second }, { tag: duration }])
    expect((await find()).items[0].tasteScore).toBeCloseTo(0.4, 12)
  })

  it.each([
    "zeroRelevance",
    "zeroSignificance",
    "notTaste",
    "wrongType",
    "missingTag",
    "nullGroup",
  ])(
    "возвращает нейтральный балл для неучаствующей разметки: %s",
    async (kind) => {
      const group =
        kind === "notTaste"
          ? ETagGroup.COUNTRY
          : kind === "wrongType"
            ? ETagGroup.DURATION
            : kind === "nullGroup"
              ? null
              : ETagGroup.GENRE
      const tag =
        kind === "missingTag"
          ? new Types.ObjectId()
          : await seedTag(group, kind === "zeroSignificance" ? 0 : 1)
      const item = await seedItem()
      await setProfile([{ tag, explicitWeight: 1 }])
      await assignTags(item, [
        { tag, relevanceScore: kind === "zeroRelevance" ? 0 : 1 },
      ])
      expect((await find()).items[0].tasteScore).toBe(0)
    },
  )

  it("предпочитает известный поджанр предкам по прямой и транзитивной связи", async () => {
    const parent = await seedTag()
    const intermediate = await seedTag(ETagGroup.SUBGENRE, 1, [parent])
    const child = await seedTag(ETagGroup.SUBGENRE, 1, [intermediate])
    await setProfile([
      { tag: parent, explicitWeight: 1 },
      { tag: intermediate, explicitWeight: 0.5 },
      { tag: child, explicitWeight: -0.8 },
    ])
    const item = await seedItem()
    await assignTags(item, [
      { tag: parent },
      { tag: intermediate },
      { tag: child },
    ])
    expect((await find()).items[0].tasteScore).toBeCloseTo(-0.8, 12)
  })

  it("не выводит родительский признак и не удаляет знакомого родителя из-за неизвестного поджанра", async () => {
    const parent = await seedTag()
    const child = await seedTag(ETagGroup.SUBGENRE, 1, [parent])
    await setProfile([{ tag: parent, explicitWeight: 0.8 }])
    const onlyChild = await seedItem()
    const both = await seedItem()
    await assignTags(onlyChild, [{ tag: child }])
    await assignTags(both, [{ tag: parent }, { tag: child }])
    const result = await find()
    expect(result.items.map((item) => [item._id, item.tasteScore])).toEqual([
      [both, 0.8],
      [onlyChild, 0],
    ])
  })

  it.each<{ library?: IRecommendationLibrary; names: string[] }>([
    {
      names: [
        "outside",
        "expired",
        "planned",
        "inProgress",
        "onHold",
        "completed",
        "dropped",
      ],
    },
    { library: { include: [] }, names: ["outside", "expired"] },
    {
      library: { include: [EUserItemStatus.PLANNED] },
      names: ["outside", "expired", "planned"],
    },
    {
      library: {
        include: [EUserItemStatus.PLANNED],
        exclude: [EUserItemStatus.PLANNED],
      },
      names: ["outside", "expired"],
    },
    { library: { only: [EUserItemStatus.PLANNED] }, names: ["planned"] },
    { library: { only: [] }, names: [] },
    {
      library: {
        only: [EUserItemStatus.COMPLETED, EUserItemStatus.IN_PROGRESS],
        exclude: [EUserItemStatus.COMPLETED],
      },
      names: ["inProgress"],
    },
    {
      library: { exclude: [EUserItemStatus.COMPLETED] },
      names: [
        "outside",
        "expired",
        "planned",
        "inProgress",
        "onHold",
        "dropped",
      ],
    },
    {
      library: { exclude: [] },
      names: [
        "outside",
        "expired",
        "planned",
        "inProgress",
        "onHold",
        "completed",
        "dropped",
      ],
    },
  ])(
    "применяет библиотечные условия и обязательные запреты: %j",
    async ({ library, names }) => {
      const records = new Map<string, Types.ObjectId>()
      const outsider = await seedItem()
      records.set("outside", outsider)
      await react({
        item: outsider,
        user: new Types.ObjectId(),
        status: EUserItemStatus.BLOCKED,
      })
      for (const status of [
        EUserItemStatus.PLANNED,
        EUserItemStatus.IN_PROGRESS,
        EUserItemStatus.ON_HOLD,
        EUserItemStatus.COMPLETED,
        EUserItemStatus.DROPPED,
      ]) {
        const item = await seedItem()
        records.set(status, item)
        await react({ item, status })
      }
      const expired = await seedItem()
      records.set("expired", expired)
      await react({
        item: expired,
        status: EUserItemStatus.SKIPPED,
        expiresAt: new Date(Date.now() - 86_400_000),
      })
      await react({
        item: await seedItem(),
        status: EUserItemStatus.SKIPPED,
        expiresAt: new Date(Date.now() + 86_400_000),
      })
      await react({
        item: await seedItem(),
        status: EUserItemStatus.SKIPPED,
        expiresAt: null,
      })
      await react({ item: await seedItem(), status: EUserItemStatus.BLOCKED })

      const result = await find({ library })

      expect(result.items.map((item) => String(item._id)).sort()).toEqual(
        names.map((name) => String(records.get(name))).sort(),
      )
      expect(result.total).toBe(names.length)
    },
  )

  it("считает skipped истёкшим точно на границе expiresAt без зависимости от TTL", async () => {
    const now = new Date(Date.now() + 86_400_000)
    const expired = await seedItem()
    const active = await seedItem()
    await react({
      item: expired,
      status: EUserItemStatus.SKIPPED,
      expiresAt: now,
    })
    await react({
      item: active,
      status: EUserItemStatus.SKIPPED,
      expiresAt: new Date(now.getTime() + 1),
    })
    const result = await repository.readRecommendations({
      userId,
      preferences: [],
      siteRatingAverage: null,
      now,
      page: 1,
      limit: 20,
    })
    expect(result.items.map((item) => item._id)).toEqual([expired])
    expect(result.total).toBe(1)
  })

  it("проверяет удаление, тип, клиентские исключения и глобальный запрет по ID произведения до total", async () => {
    const allowed = await seedItem()
    const anotherAllowed = await seedItem()
    const banned = await seedItem()
    const excluded = await seedItem()
    await seedItem({ deletedAt: new Date() })
    await seedItem({ type: EItemType.MOVIE })
    await getTestDatabase()
      .connection.collection("ItemBan")
      .insertOne({ item: banned, countries: [] })
    const result = await find({
      filter: { types: [EItemType.GAME] },
      excludeItemIds: [excluded],
    })
    expect(result.items.map((item) => item._id)).toEqual([
      allowed,
      anotherAllowed,
    ])
    expect(result.total).toBe(2)
    expect((await find({ filter: { types: [] } })).total).toBe(0)
  })

  it.each([
    { countries: [ECountry.RUSSIA], country: ECountry.RUSSIA, isBlocked: true },
    {
      countries: [ECountry.RUSSIA],
      country: ECountry.UNITED_STATES,
      isBlocked: false,
    },
    {
      countries: [ECountry.RUSSIA],
      country: ECountry.UNKNOWN,
      isBlocked: false,
    },
    { countries: [ECountry.RUSSIA], country: undefined, isBlocked: false },
    {
      countries: [ECountry.RUSSIA, ECountry.KAZAKHSTAN],
      country: ECountry.KAZAKHSTAN,
      isBlocked: true,
    },
    {
      countries: [ECountry.UNKNOWN],
      country: ECountry.UNKNOWN,
      isBlocked: true,
    },
    { countries: [ECountry.UNKNOWN], country: undefined, isBlocked: true },
    {
      countries: [ECountry.UNKNOWN],
      country: ECountry.RUSSIA,
      isBlocked: false,
    },
    { countries: [], country: ECountry.RUSSIA, isBlocked: true },
    { countries: [], country: ECountry.UNITED_STATES, isBlocked: true },
    { countries: [], country: ECountry.UNKNOWN, isBlocked: true },
    { countries: [], country: undefined, isBlocked: true },
  ])(
    "применяет запрет $countries для страны входа $country",
    async ({ countries, country, isBlocked }) => {
      const item = await seedItem()
      const { connection } = getTestDatabase()
      await connection.collection("ItemBan").insertOne({
        item,
        countries,
      })

      const result = await find({ country })

      expect(result.items.map((entry) => entry._id)).toEqual(
        isBlocked ? [] : [item],
      )
      expect(result.total).toBe(isBlocked ? 0 : 1)
    },
  )

  it("объединяет точные теги, тип, даты, длительность и обычную оценку через И", async () => {
    const firstTag = await seedTag()
    const secondTag = await seedTag()
    const earliest = new Date("2020-01-01")
    const latest = new Date("2021-01-01")
    const lower = await seedItem({
      type: EItemType.MOVIE,
      movie: { duration: 90 },
      releaseDate: earliest,
    })
    const upper = await seedItem({
      type: EItemType.MOVIE,
      movie: { duration: 120 },
      releaseDate: latest,
    })
    const missingDuration = await seedItem({
      type: EItemType.MOVIE,
      releaseDate: earliest,
    })
    const missingDate = await seedItem({
      type: EItemType.MOVIE,
      movie: { duration: 100 },
    })
    const missingRating = await seedItem({
      type: EItemType.MOVIE,
      movie: { duration: 100 },
      releaseDate: earliest,
    })
    const missingTag = await seedItem({
      type: EItemType.MOVIE,
      movie: { duration: 100 },
      releaseDate: earliest,
    })
    const long = await seedItem({
      type: EItemType.MOVIE,
      movie: { duration: 121 },
      releaseDate: earliest,
    })
    const wrongType = await seedItem({
      movie: { duration: 100 },
      releaseDate: earliest,
    })
    for (const item of [
      lower,
      upper,
      missingDuration,
      missingDate,
      missingRating,
      long,
      wrongType,
    ]) {
      await assignTags(item, [{ tag: firstTag }, { tag: secondTag }])
    }
    await assignTags(missingTag, [{ tag: firstTag }])
    await getTestDatabase()
      .connection.collection("ItemStats")
      .insertMany(
        [
          lower,
          upper,
          missingDuration,
          missingDate,
          missingTag,
          long,
          wrongType,
        ].map((item) => ({
          item,
          ratingAverage: item.equals(upper) ? 9 : 8,
          ratingsCount: 20,
        })),
      )
    const filter = {
      types: [EItemType.MOVIE],
      tagIds: [firstTag, secondTag],
      fields: [
        { field: EItemField.DURATION, min: 90, max: 120 },
        { field: EItemField.RELEASE_DATE, min: earliest, max: latest },
      ],
      ratingMin: 8,
      ratingMax: 9,
    }
    const result = await find({ filter })
    expect(result.items.map((item) => item._id)).toEqual([upper, lower])
    expect(result.total).toBe(2)
    expect((await find({ filter, excludeItemIds: [upper] })).total).toBe(1)
  })

  it("фильтрует время прохождения и числовой возраст, включая преобразование 18++", async () => {
    const allowed = await seedItem({
      game: { mainStoryDuration: 120 },
      ageRestriction: EAgeRestriction.AGE_18_PLUS_PLUS,
    })
    await seedItem({
      game: { mainStoryDuration: 181 },
      ageRestriction: EAgeRestriction.AGE_18,
    })
    await seedItem({
      game: { mainStoryDuration: 120 },
      ageRestriction: EAgeRestriction.AGE_16,
    })
    await seedItem({ ageRestriction: EAgeRestriction.AGE_18 })
    const result = await find({
      filter: {
        fields: [
          { field: EItemField.MAIN_STORY_DURATION, max: 180 },
          { field: EItemField.AGE_RESTRICTION, min: 18, max: 18 },
        ],
      },
    })
    expect(result.items.map((item) => item._id)).toEqual([allowed])
  })

  it("ограничивает выдачу участниками подборки и её действительными группами", async () => {
    const collectionId = new Types.ObjectId()
    const firstGroup = new Types.ObjectId()
    const secondGroup = new Types.ObjectId()
    const textBlock = new Types.ObjectId()
    await getTestDatabase()
      .connection.collection("Collection")
      .insertOne({
        _id: collectionId,
        title: { ru: "Подборка", en: null },
        deletedAt: null,
        blocks: [
          { id: firstGroup, type: ECollectionBlockType.GROUP },
          { id: secondGroup, type: ECollectionBlockType.GROUP },
          {
            id: textBlock,
            type: ECollectionBlockType.TEXT,
            content: { ru: "Текст", en: null },
          },
        ],
      })
    const first = await seedItem()
    const second = await seedItem()
    const orphan = await seedItem()
    await seedItem()
    await getTestDatabase()
      .connection.collection("ItemCollection")
      .insertMany([
        { collectionId, item: first, groupId: firstGroup },
        { collectionId, item: second, groupId: secondGroup },
        { collectionId, item: orphan, groupId: textBlock },
      ])
    expect(
      (await find({ filter: { collectionId } })).items.map((item) => item._id),
    ).toEqual([first, second])
    const scoped = await find({
      filter: { collectionId, groupId: secondGroup },
    })
    expect(scoped.items.map((item) => item._id)).toEqual([second])
    expect(scoped.total).toBe(1)
  })

  it("ранжирует всю выборку до пагинации и сохраняет total на пустой дальней странице", async () => {
    const liked = await seedTag()
    const disliked = await seedTag()
    await setProfile([
      { tag: liked, explicitWeight: 1 },
      { tag: disliked, explicitWeight: -1 },
    ])
    const negative = await seedItem()
    const neutral = await seedItem()
    const positive = await seedItem()
    await assignTags(negative, [{ tag: disliked }])
    await assignTags(positive, [{ tag: liked }])
    const first = await find({ pagination: { page: 1, limit: 2 } })
    const second = await find({ pagination: { page: 2, limit: 2 } })
    const pastEnd = await find({ pagination: { page: 3, limit: 2 } })
    expect(first.items.map((item) => item._id)).toEqual([positive, neutral])
    expect(second.items.map((item) => item._id)).toEqual([negative])
    expect(first).toMatchObject({
      total: 3,
      pages: 2,
      isNextPage: true,
      isPreviousPage: false,
    })
    expect(second).toMatchObject({
      total: 3,
      pages: 2,
      isNextPage: false,
      isPreviousPage: true,
    })
    expect(pastEnd).toMatchObject({
      items: [],
      total: 3,
      pages: 2,
      isNextPage: false,
      isPreviousPage: true,
    })
  })

  it("пересекает заданных кандидатов с фильтрами и исключениями до total и не расширяет пустой список", async () => {
    const first = await seedItem()
    const excluded = await seedItem()
    const wrongType = await seedItem({ type: EItemType.MOVIE })
    await seedItem()
    const missing = new Types.ObjectId()
    const candidateItemIds = [wrongType, excluded, first, first, missing]
    const props = {
      candidateItemIds,
      excludeItemIds: [excluded],
      filter: { types: [EItemType.GAME] },
    }
    const result = await find(props)
    expect(result.total).toBe(1)
    expect(result.items.map((item) => item._id)).toEqual([first])
    expect(
      (await find({ ...props, pagination: { page: 2, limit: 1 } })).items,
    ).toEqual([])
    expect(await find({ candidateItemIds: [] })).toMatchObject({
      items: [],
      total: 0,
    })
    expect(candidateItemIds).toEqual([
      wrongType,
      excluded,
      first,
      first,
      missing,
    ])
  })

  it("меняет направление итогового балла до пагинации, сохраняя убывание рейтинга для равных баллов", async () => {
    const liked = await seedTag()
    const disliked = await seedTag()
    await setProfile([
      { tag: liked, explicitWeight: 1 },
      { tag: disliked, explicitWeight: -1 },
    ])
    const positive = await seedItem()
    const lowerRated = await seedItem()
    const higherRated = await seedItem()
    const negative = await seedItem()
    await getTestDatabase()
      .connection.collection("ItemStats")
      .insertMany([
        { item: lowerRated, ratingAverage: 5, ratingsCount: 20 },
        { item: higherRated, ratingAverage: 9, ratingsCount: 20 },
      ])
    await assignTags(positive, [{ tag: liked }])
    await assignTags(negative, [{ tag: disliked }])
    const descending = await find({ direction: "desc" })
    const ascending = await find({ direction: "asc" })
    expect(descending.items.map((item) => item._id)).toEqual([
      positive,
      higherRated,
      lowerRated,
      negative,
    ])
    expect(ascending.items.map((item) => item._id)).toEqual([
      negative,
      higherRated,
      lowerRated,
      positive,
    ])
    const page = await find({
      direction: "asc",
      pagination: { page: 2, limit: 2 },
    })
    expect(page.total).toBe(4)
    expect(page.items.map((item) => item._id)).toEqual([lowerRated, positive])
  })

  it("для нового пользователя разрешает равенство сглаженным рейтингом и затем ID", async () => {
    const unrated = await seedItem()
    const singleVote = await seedItem()
    const manyVotes = await seedItem()
    const sameScore = await seedItem()
    await getTestDatabase()
      .connection.collection("ItemStats")
      .insertMany([
        { item: singleVote, ratingAverage: 10, ratingsCount: 1 },
        { item: manyVotes, ratingAverage: 9, ratingsCount: 20 },
        { item: sameScore, ratingAverage: 9, ratingsCount: 20 },
      ])
    const result = await find()
    expect(result.items.map((item) => item._id)).toEqual([
      manyVotes,
      sameScore,
      singleVote,
      unrated,
    ])
    expect(result.items[0].ratingScore).toBe(7.25)
    expect(result.items[2].ratingScore).toBeCloseTo(120 / 21, 12)
    expect(result.items[3].ratingScore).toBe(5.5)
    expect((await find()).items.map((item) => item._id)).toEqual(
      result.items.map((item) => item._id),
    )
  })

  it("использует сохранённую среднюю SiteStats без обхода пользовательских оценок", async () => {
    const candidate = await seedItem()
    await getTestDatabase()
      .connection.collection("SiteStats")
      .insertOne({ key: "ratings", sum: 181, count: 21, average: 181 / 21 })
    await getTestDatabase()
      .connection.collection("UserItem")
      .insertOne({ item: candidate, user: new Types.ObjectId(), rating: 1 })
    expect(
      (await find()).items.find((item) => item._id.equals(candidate))
        ?.ratingScore,
    ).toBeCloseTo(181 / 21, 12)
  })

  it.each<{ rating: number | null; isFavorite: boolean; sympathy: number }>([
    { rating: null, isFavorite: false, sympathy: 0 },
    { rating: null, isFavorite: true, sympathy: 0.5 },
    ...[1, 2, 3, 4, 5, 6].flatMap((rating) => [
      { rating, isFavorite: false, sympathy: 0 },
      { rating, isFavorite: true, sympathy: rating <= 4 ? 0 : 0.5 },
    ]),
    { rating: 7, isFavorite: false, sympathy: 0.25 },
    { rating: 8, isFavorite: false, sympathy: 0.5 },
    { rating: 9, isFavorite: false, sympathy: 0.75 },
    { rating: 10, isFavorite: false, sympathy: 1 },
    { rating: 7, isFavorite: true, sympathy: 0.5 },
    { rating: 8, isFavorite: true, sympathy: 0.5 },
    { rating: 9, isFavorite: true, sympathy: 0.75 },
    { rating: 10, isFavorite: true, sympathy: 1 },
  ])(
    "учитывает силу реакции на источник и приоритет низкой оценки: %j",
    async ({ rating, isFavorite, sympathy }) => {
      const source = await seedItem({ type: EItemType.MOVIE })
      const candidate = await seedItem()
      await react({ item: source, rating, isFavorite })
      await link({ candidate, source, multiplier: 2 })
      const result = await find({ filter: { types: [EItemType.GAME] } })
      expect(result.items).toHaveLength(1)
      expect(result.items[0].relationBoost).toBeCloseTo(sympathy, 12)
      expect(result.items[0].finalScore).toBeCloseTo(1 + sympathy, 12)
    },
  )

  it.each([true, false])(
    "использует роль кандидата при обеих ориентациях связи: first=%s",
    async (isCandidateFirst) => {
      const source = await seedItem({ type: EItemType.MOVIE })
      const candidate = await seedItem()
      await react({
        item: source,
        rating: 10,
        status: EUserItemStatus.IN_PROGRESS,
      })
      await link({ candidate, source, multiplier: 1.5, isCandidateFirst })
      const item = (await find({ filter: { types: [EItemType.GAME] } }))
        .items[0]
      expect(item.relationBoost).toBe(0.5)
      expect(item.finalScore).toBe(1.5)
    },
  )

  it("берёт максимальный бонус среди разных источников и обеих сторон вместо суммы", async () => {
    const firstSource = await seedItem({ type: EItemType.MOVIE })
    const secondSource = await seedItem({ type: EItemType.MOVIE })
    const candidate = await seedItem()
    await react({ item: firstSource, rating: 10 })
    await react({ item: secondSource, rating: 8 })
    await link({
      candidate,
      source: firstSource,
      multiplier: 1.5,
      isCandidateFirst: true,
    })
    await link({ candidate, source: secondSource, multiplier: 3 })
    const item = (await find({ filter: { types: [EItemType.GAME] } })).items[0]
    expect(item.relationBoost).toBe(1)
    expect(item.finalScore).toBe(2)
  })

  it.each([
    "skipped",
    "blocked",
    "deleted",
    "missing",
    "foreign",
    "completedWithoutReaction",
    "missingMultiplier",
  ])(
    "проверяет допустимость источника и отсутствие множителя: %s",
    async (kind) => {
      const source =
        kind === "missing"
          ? new Types.ObjectId()
          : await seedItem({
              type: EItemType.MOVIE,
              ...(kind === "deleted" ? { deletedAt: new Date() } : {}),
            })
      const candidate = await seedItem()
      await react({
        item: source,
        rating: kind === "completedWithoutReaction" ? null : 10,
        status:
          kind === "skipped"
            ? EUserItemStatus.SKIPPED
            : kind === "blocked"
              ? EUserItemStatus.BLOCKED
              : EUserItemStatus.COMPLETED,
        ...(kind === "foreign" ? { user: new Types.ObjectId() } : {}),
      })
      await link({
        candidate,
        source,
        ...(kind === "missingMultiplier" ? {} : { multiplier: 1.5 }),
      })
      const item = (await find({ filter: { types: [EItemType.GAME] } }))
        .items[0]
      expect(item.relationBoost).toBe(kind === "blocked" ? 0.5 : 0)
    },
  )

  it("складывает прибавки planned и связи и поднимает отрицательное соответствие выше нейтрального", async () => {
    const source = await seedItem({ type: EItemType.MOVIE })
    const candidate = await seedItem()
    const neutral = await seedItem()
    const disliked = await seedTag()
    await setProfile([{ tag: disliked, explicitWeight: -0.4 }])
    await assignTags(candidate, [{ tag: disliked }])
    await react({ item: source, rating: 10 })
    await react({ item: candidate })
    await link({ candidate, source, multiplier: 1.5 })
    const result = await find({ filter: { types: [EItemType.GAME] } })
    expect(result.items.map((item) => item._id)).toEqual([candidate, neutral])
    expect(result.items[0]).toMatchObject({
      tasteScore: -0.4,
      baseScore: 0.8,
      plannedBoost: 0.2,
      relationBoost: 0.5,
      finalScore: 1.36,
    })
    expect(result.items[1].finalScore).toBe(1)
  })

  it("разрешает математически равные баллы рейтингом после устранения погрешности умножения", async () => {
    const source = await seedItem({ type: EItemType.MOVIE })
    const related = await seedItem()
    const planned = await seedItem()
    const tag = await seedTag()
    await setProfile([{ tag, explicitWeight: -0.4 }])
    await assignTags(related, [{ tag }])
    await react({ item: source, rating: 10 })
    await react({ item: planned })
    await link({ candidate: related, source, multiplier: 1.5 })
    await getTestDatabase()
      .connection.collection("ItemStats")
      .insertMany([
        { item: related, ratingAverage: 6, ratingsCount: 20 },
        { item: planned, ratingAverage: 9, ratingsCount: 20 },
      ])
    const result = await find({ filter: { types: [EItemType.GAME] } })
    expect(result.items.map((item) => item._id)).toEqual([planned, related])
    expect(result.items.map((item) => item.finalScore)).toEqual([1.2, 1.2])
  })

  it("проверяет текущую доступность кандидата без ожидания пересчёта профиля", async () => {
    const tag = await seedTag()
    const candidate = await seedItem()
    await setProfile([{ tag, explicitWeight: 1 }])
    await assignTags(candidate, [{ tag }])
    expect((await find()).total).toBe(1)
    await react({ item: candidate, status: EUserItemStatus.BLOCKED })
    expect((await find()).total).toBe(0)
    await getTestDatabase()
      .connection.collection("UserItem")
      .deleteOne({ user: userId, item: candidate })
    expect((await find()).items[0].tasteScore).toBe(1)
  })
})
