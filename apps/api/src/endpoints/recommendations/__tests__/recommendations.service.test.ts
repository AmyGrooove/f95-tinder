import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals"
import { BadRequestException, NotFoundException } from "@nestjs/common"
import { Test, type TestingModule } from "@nestjs/testing"
import { Types } from "mongoose"

import { CollectionRepository } from "@entities/collection/services/collection.repository"
import { ECollectionBlockType } from "@entities/collection/schemas/ECollectionBlockType"
import { ItemRepository } from "@entities/item/services/item.repository"
import { EItemField } from "@entities/item/schemas/EItemField"
import { EItemType } from "@entities/item/schemas/EItemType"
import { EUserItemStatus } from "@entities/userItem/schemas/EUserItemStatus"
import { SiteRatingsStatsRepository } from "@entities/siteStats/services/siteRatingsStats.repository"
import { UserTasteProfileRepository } from "@entities/userTasteProfile/services/userTasteProfile.repository"
import type { TasteTagPreference } from "@entities/userTasteProfile/schemas/tasteTagPreference.schema"
import { DICTIONARY } from "@entities/shared/static/DICTIONARY"

import { RecommendationsService } from "../services/recommendations.service"
import type { IFindRecommendationsProps } from "../types/IFindRecommendationsProps"
import { ECountry } from "@entities/shared/schemas/ECountry"

describe("RecommendationsService", () => {
  const userId = new Types.ObjectId()
  const collectionId = new Types.ObjectId()
  const groupId = new Types.ObjectId()
  const otherGroupId = new Types.ObjectId()
  const textId = new Types.ObjectId()
  const readRecommendations = jest.fn<ItemRepository["readRecommendations"]>()
  const readRatingBaseline =
    jest.fn<SiteRatingsStatsRepository["readRatingBaseline"]>()
  const findProfile =
    jest.fn<
      (
        filter: unknown,
      ) => Promise<{ tagPreferences: TasteTagPreference[] } | null>
    >()
  const findCollection = jest.fn<
    (id: Types.ObjectId) => Promise<{
      blocks: { id: Types.ObjectId; type: ECollectionBlockType }[]
    } | null>
  >()
  let module: TestingModule
  let service: RecommendationsService

  beforeEach(async () => {
    readRecommendations.mockReset().mockResolvedValue({ items: [], total: 0 })
    readRatingBaseline.mockReset().mockResolvedValue({ average: 7 })
    findProfile.mockReset().mockResolvedValue(null)
    findCollection.mockReset().mockResolvedValue({
      blocks: [
        { id: groupId, type: ECollectionBlockType.GROUP },
        { id: otherGroupId, type: ECollectionBlockType.GROUP },
        { id: textId, type: ECollectionBlockType.TEXT },
      ],
    })
    module = await Test.createTestingModule({
      providers: [
        RecommendationsService,
        { provide: ItemRepository, useValue: { readRecommendations } },
        {
          provide: CollectionRepository,
          useValue: { findNotDeletedById: findCollection },
        },
        {
          provide: SiteRatingsStatsRepository,
          useValue: { readRatingBaseline },
        },
        {
          provide: UserTasteProfileRepository,
          useValue: { read: { findOne: findProfile } },
        },
      ],
    }).compile()
    service = module.get(RecommendationsService)
  })

  afterEach(async () => {
    await module.close()
  })

  it("использует пустой профиль и стандартную страницу для нового пользователя", async () => {
    readRatingBaseline.mockResolvedValue({ average: 5.5 })
    const result = await service.find({ userId })

    expect(readRecommendations).toHaveBeenCalledWith(
      expect.objectContaining({
        userId,
        preferences: [],
        siteRatingAverage: 5.5,
        now: expect.any(Date),
        page: 1,
        limit: 20,
      }),
    )
    expect(findProfile).toHaveBeenCalledWith({ user: userId })
    expect(findCollection).not.toHaveBeenCalled()
    expect(result).toEqual({
      items: [],
      total: 0,
      page: 1,
      limit: 20,
      pages: 0,
      isNextPage: false,
      isPreviousPage: false,
    })
  })

  it("передаёт профиль и все условия без потери явных настроек и возвращает карточки с пагинацией", async () => {
    const preferences = [
      { tag: new Types.ObjectId(), weight: -0.5, count: 5, explicitWeight: 1 },
    ]
    findProfile.mockResolvedValue({ tagPreferences: preferences })
    const item = {
      _id: new Types.ObjectId(),
      type: EItemType.GAME,
      title: { ru: "Игра", en: null },
      media: [],
      tasteScore: 1,
      baseScore: 1.5,
      plannedBoost: 0,
      relationBoost: 0,
      finalScore: 1.5,
      ratingScore: 7,
    }
    readRecommendations.mockResolvedValue({ items: [item], total: 250 })
    const props: IFindRecommendationsProps = {
      userId,
      country: ECountry.RUSSIA,
      filter: { types: [EItemType.GAME], tagIds: [preferences[0].tag] },
      library: {
        include: [EUserItemStatus.PLANNED],
        exclude: [EUserItemStatus.COMPLETED],
      },
      excludeItemIds: [new Types.ObjectId()],
      candidateItemIds: [new Types.ObjectId()],
      isIncludingExcluded: true,
      direction: "asc",
      pagination: { page: 2.9, limit: 1000 },
    }

    const result = await service.find(props)

    expect(readRecommendations).toHaveBeenCalledWith(
      expect.objectContaining({
        userId,
        preferences,
        siteRatingAverage: 7,
        filter: props.filter,
        country: ECountry.RUSSIA,
        library: props.library,
        excludeItemIds: props.excludeItemIds,
        candidateItemIds: props.candidateItemIds,
        isIncludingExcluded: true,
        direction: "asc",
        page: 2,
        limit: 100,
      }),
    )
    expect(result).toEqual({
      items: [item],
      total: 250,
      page: 2,
      limit: 100,
      pages: 3,
      isNextPage: true,
      isPreviousPage: true,
    })
    expect(preferences[0]).toEqual({
      tag: preferences[0].tag,
      weight: -0.5,
      count: 5,
      explicitWeight: 1,
    })
  })

  it.each([
    {
      library: { include: [], only: [] },
      message: DICTIONARY.recommendations.conflictingLibrary,
    },
    {
      filter: { groupId },
      message: DICTIONARY.recommendations.collectionRequired,
    },
    {
      pagination: { page: Number.MAX_SAFE_INTEGER, limit: 100 },
      message: DICTIONARY.recommendations.invalidPagination,
    },
    ...[
      { ratingMin: 0 },
      { ratingMin: 11 },
      { ratingMax: 0 },
      { ratingMax: 11 },
      { ratingMin: NaN },
      { ratingMax: Infinity },
      { ratingMin: 9, ratingMax: 8 },
    ].map((filter) => ({
      filter,
      message: DICTIONARY.recommendations.invalidRatingRange,
    })),
    ...[
      { field: EItemField.DURATION },
      { field: "unknown" as EItemField, min: 0 },
      { field: "toString" as EItemField, min: 0 },
      { field: "__proto__" as EItemField, min: 0 },
      { field: EItemField.DURATION, min: 100, max: 10 },
      { field: EItemField.DURATION, min: NaN },
      { field: EItemField.DURATION, max: Infinity },
      { field: EItemField.DURATION, min: new Date() },
      { field: EItemField.RELEASE_DATE, min: 2020 },
      { field: EItemField.RELEASE_DATE, min: new Date(NaN) },
      {
        field: EItemField.RELEASE_DATE,
        min: new Date("2026-01-01"),
        max: new Date("2025-01-01"),
      },
    ].map((field) => ({
      filter: { fields: [field] },
      message: DICTIONARY.recommendations.invalidFieldRange,
    })),
  ])(
    "отклоняет некорректные условия до обращения к данным: %j",
    async ({ message, ...conditions }) => {
      await expect(service.find({ userId, ...conditions })).rejects.toThrow(
        new BadRequestException(message),
      )
      expect(findCollection).not.toHaveBeenCalled()
      expect(findProfile).not.toHaveBeenCalled()
      expect(readRatingBaseline).not.toHaveBeenCalled()
      expect(readRecommendations).not.toHaveBeenCalled()
    },
  )

  it.each([
    { ratingMin: 1, ratingMax: 10 },
    { fields: [{ field: EItemField.DURATION, min: 0 }] },
    {
      fields: [{ field: EItemField.RELEASE_DATE, max: new Date("2026-01-01") }],
    },
    {
      fields: [{ field: EItemField.DURATION, min: 90, max: 90 }],
      ratingMin: 7.5,
      ratingMax: 7.5,
    },
  ])(
    "принимает односторонние и включительные диапазоны: %j",
    async (filter) => {
      await service.find({ userId, filter })
      expect(readRecommendations).toHaveBeenCalledWith(
        expect.objectContaining({ filter }),
      )
    },
  )

  it("ограничивает подборку её действительными группами без текстовых блоков", async () => {
    await service.find({ userId, filter: { collectionId } })
    expect(findCollection).toHaveBeenCalledWith(collectionId)
    expect(readRecommendations).toHaveBeenCalledWith(
      expect.objectContaining({ collectionGroupIds: [groupId, otherGroupId] }),
    )
  })

  it("ограничивает запрос выбранной группой подборки", async () => {
    await service.find({ userId, filter: { collectionId, groupId } })
    expect(readRecommendations).toHaveBeenCalledWith(
      expect.objectContaining({ collectionGroupIds: [groupId] }),
    )
  })

  it("не снимает ограничение подборки без групп", async () => {
    findCollection.mockResolvedValue({
      blocks: [{ id: textId, type: ECollectionBlockType.TEXT }],
    })

    await service.find({ userId, filter: { collectionId } })

    expect(readRecommendations).toHaveBeenCalledWith(
      expect.objectContaining({ collectionGroupIds: [] }),
    )
  })

  it.each([new Types.ObjectId(), textId])(
    "отклоняет чужую группу и текстовый блок: %s",
    async (invalidGroup) => {
      await expect(
        service.find({
          userId,
          filter: { collectionId, groupId: invalidGroup },
        }),
      ).rejects.toThrow(
        new BadRequestException(DICTIONARY.collection.invalidGroup),
      )
      expect(readRecommendations).not.toHaveBeenCalled()
    },
  )

  it("отклоняет отсутствующую или удалённую подборку", async () => {
    findCollection.mockResolvedValue(null)
    await expect(
      service.find({ userId, filter: { collectionId } }),
    ).rejects.toBeInstanceOf(NotFoundException)
    expect(readRecommendations).not.toHaveBeenCalled()
  })

  it("передаёт ошибку чтения подборки до чтения профиля и кандидатов", async () => {
    const error = new Error("Collection unavailable")
    findCollection.mockRejectedValue(error)

    await expect(
      service.find({ userId, filter: { collectionId } }),
    ).rejects.toBe(error)
    expect(findProfile).not.toHaveBeenCalled()
    expect(readRatingBaseline).not.toHaveBeenCalled()
    expect(readRecommendations).not.toHaveBeenCalled()
  })

  it.each(["profile", "siteAverage", "candidates"])(
    "передаёт ошибку чтения вызывающему коду: %s",
    async (dependency) => {
      const error = new Error("MongoDB unavailable")
      if (dependency === "profile") {
        findProfile.mockRejectedValue(error)
      } else if (dependency === "siteAverage") {
        readRatingBaseline.mockRejectedValue(error)
      } else {
        readRecommendations.mockRejectedValue(error)
      }
      await expect(service.find({ userId })).rejects.toBe(error)
      if (dependency !== "candidates") {
        expect(readRecommendations).not.toHaveBeenCalled()
      }
    },
  )
})
