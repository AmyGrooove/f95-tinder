import { describe, expect, it, jest } from "@jest/globals"
import { Types } from "mongoose"

import type {
  IRecommendationFeedSources,
  RecommendationsService,
} from "@endpoints/recommendations/services/recommendationsService"
import { EItemType } from "@entities/item/schemas/EItemType"
import type { ItemRepository } from "@entities/item/services/itemRepository"
import type { ItemRelationRepository } from "@entities/itemRelation/services/itemRelationRepository"
import type { RelationRepository } from "@entities/relation/services/relationRepository"
import { ECountry } from "@entities/shared/schemas/ECountry"
import { EUserItemStatus } from "@entities/userItem/schemas/EUserItemStatus"
import type { UserItemRepository } from "@entities/userItem/services/userItemRepository"

import { RecommendationFeedService } from "../core/recommendationFeed.service"

describe("RecommendationFeedService", () => {
  const setup = () => {
    const context = {
      userId: new Types.ObjectId(),
      country: ECountry.GEORGIA,
      siteRatingAverage: null,
    }
    const types = [EItemType.MOVIE, EItemType.GAME]
    const positiveIds = Array.from({ length: 5 }, () => new Types.ObjectId())
    const plannedId = new Types.ObjectId()
    const readPositiveRecommendationItemIds = jest
      .fn<UserItemRepository["readPositiveRecommendationItemIds"]>()
      .mockResolvedValue(positiveIds)
    const readPlannedItemIds = jest
      .fn<UserItemRepository["readPlannedItemIds"]>()
      .mockResolvedValue([plannedId])
    const findNotDeletedByIds = jest
      .fn<ItemRepository["findNotDeletedByIds"]>()
      .mockImplementation(
        async (ids) =>
          ids.map((_id) => ({ _id })) as Awaited<
            ReturnType<ItemRepository["findNotDeletedByIds"]>
          >,
      )
    const readEligibleRecommendationItems =
      jest.fn<ItemRepository["readEligibleRecommendationItems"]>()
    const findRelation = jest
      .fn<() => Promise<{ _id: Types.ObjectId } | null>>()
      .mockResolvedValue(null)
    const readRelatedItemIds =
      jest.fn<ItemRelationRepository["readRelatedItemIds"]>()
    const loadLatestModel = jest.fn<RecommendationsService["loadLatestModel"]>()
    let sources: IRecommendationFeedSources
    const readFeedPage = jest
      .fn<RecommendationsService["readFeedPage"]>()
      .mockImplementation(async (_token, _props, buildSources) => {
        sources = await buildSources(context, types)
        return { items: [], count: 0, nextCursor: null }
      })
    const service = new RecommendationFeedService(
      { readFeedPage, loadLatestModel } as unknown as RecommendationsService,
      {
        readPositiveRecommendationItemIds,
        readPlannedItemIds,
      } as unknown as UserItemRepository,
      {
        findNotDeletedByIds,
        readEligibleRecommendationItems,
      } as unknown as ItemRepository,
      { readRelatedItemIds } as unknown as ItemRelationRepository,
      { read: { findOne: findRelation } } as unknown as RelationRepository,
    )

    const read = async (props?: Parameters<typeof service.readPage>[1]) => {
      await service.readPage("test-token", props)
      return sources
    }

    return {
      read,
      userId: context.userId,
      readPositiveRecommendationItemIds,
      readPlannedItemIds,
      readEligibleRecommendationItems,
      findRelation,
      readRelatedItemIds,
      loadLatestModel,
      positiveIds,
      plannedId,
    }
  }

  it.each([
    {
      anyOf: [EUserItemStatus.PLANNED],
      isPromoted: false,
      isHistoryRead: true,
    },
    {
      anyOf: ["outside", EUserItemStatus.PLANNED],
      isPromoted: true,
      isHistoryRead: true,
    },
    { anyOf: ["outside"], isPromoted: false, isHistoryRead: true },
    { anyOf: [], isPromoted: false, isHistoryRead: false },
  ] as const)(
    "читает planned для бонуса только в смешанном режиме $anyOf",
    async ({ anyOf, isPromoted, isHistoryRead }) => {
      const {
        read,
        userId,
        readPositiveRecommendationItemIds,
        readPlannedItemIds,
        loadLatestModel,
        plannedId,
      } = setup()
      loadLatestModel.mockResolvedValue(null)

      const sources = await read({ filter: { library: { anyOf: [...anyOf] } } })

      expect(readPositiveRecommendationItemIds.mock.calls).toEqual(
        isHistoryRead ? [[userId]] : [],
      )
      expect(readPlannedItemIds.mock.calls).toEqual(
        isPromoted ? [[userId]] : [],
      )
      expect(sources?.plannedIds?.has(plannedId.toHexString()) ?? false).toBe(
        isPromoted,
      )
      expect(sources?.personalByType).toBeUndefined()
    },
  )

  it.each([
    { failure: "неразложимая матрица ALS", isUnexpectedError: false },
    { failure: "неожиданная ошибка вычисления", isUnexpectedError: true },
  ])(
    "обрабатывает сбой персонального ранжирования: $failure",
    async ({ isUnexpectedError }) => {
      const {
        read,
        positiveIds,
        loadLatestModel,
        readEligibleRecommendationItems,
        plannedId,
      } = setup()
      const itemIds = positiveIds.map(String)
      const gram = Float64Array.of(0)
      const failure = new Error("Ошибка доступа к матрице")
      if (isUnexpectedError) {
        jest.spyOn(gram, "slice").mockImplementation(() => {
          throw failure
        })
      }
      loadLatestModel.mockResolvedValue({
        id: new Types.ObjectId().toHexString(),
        createdAt: new Date(),
        itemIds,
        itemCF: {
          offsets: new Int32Array(itemIds.length + 1),
          indices: new Int32Array(),
          weights: new Float32Array(),
        },
        als: {
          factors: 1,
          alpha: 2,
          regularization: 0,
          itemFactors: new Float32Array(itemIds.length),
          gram,
        },
        popularity: new Float32Array(itemIds.length),
      })

      const result = read({
        filter: { library: { anyOf: ["outside", EUserItemStatus.PLANNED] } },
      })

      if (isUnexpectedError) {
        await expect(result).rejects.toBe(failure)
      } else {
        await expect(result).resolves.toEqual({
          plannedIds: new Set([plannedId.toHexString()]),
        })
      }
      expect(readEligibleRecommendationItems).not.toHaveBeenCalled()
    },
  )

  it("объединяет до 500 допустимых позиций каждого алгоритма отдельно для каждого типа", async () => {
    const {
      read,
      positiveIds,
      loadLatestModel,
      readEligibleRecommendationItems,
      findRelation,
      readRelatedItemIds,
    } = setup()
    const movies = Array.from({ length: 502 }, () => new Types.ObjectId())
    const games = Array.from({ length: 501 }, () => new Types.ObjectId())
    const disallowed = Array.from({ length: 501 }, () => new Types.ObjectId())
    const ids = [...positiveIds, ...disallowed, ...movies, ...games]
    const movieOnlyInCf = movies[500]
    const itemIds = ids.map(String)
    const offsets = new Int32Array(ids.length + 1).fill(1)
    offsets[0] = 0
    loadLatestModel.mockResolvedValue({
      id: new Types.ObjectId().toHexString(),
      createdAt: new Date(),
      itemIds,
      itemCF: {
        offsets,
        indices: Int32Array.of(itemIds.indexOf(movieOnlyInCf.toHexString())),
        weights: Float32Array.of(1),
      },
      als: {
        factors: 1,
        alpha: 2,
        regularization: 1,
        itemFactors: new Float32Array(ids.length),
        gram: Float64Array.of(0),
      },
      popularity: Float32Array.from(ids, (_, index) => ids.length - index),
    })
    readEligibleRecommendationItems
      .mockResolvedValueOnce([
        ...movies.map((_id) => ({ _id, type: EItemType.MOVIE })),
        ...games.map((_id) => ({ _id, type: EItemType.GAME })),
      ])
      .mockResolvedValueOnce([{ _id: positiveIds[0], type: EItemType.MOVIE }])
    findRelation.mockResolvedValue({ _id: new Types.ObjectId() })
    readRelatedItemIds.mockResolvedValue(new Set([String(movieOnlyInCf)]))

    const sources = await read()
    const rankedMovies = sources?.personalByType?.get(EItemType.MOVIE) ?? []
    const rankedGames = sources?.personalByType?.get(EItemType.GAME) ?? []
    const moviesById = new Map(
      rankedMovies.map(({ itemId, score }) => [String(itemId), score]),
    )

    expect(rankedMovies).toHaveLength(501)
    expect(rankedMovies[0]?.itemId).toEqual(movies[0])
    expect(moviesById.get(String(movies[0]))).toBeCloseTo(
      0.5 / 61 + 0.5 / 62,
      12,
    )
    expect(moviesById.get(String(movies[499]))).toBeCloseTo(0.5 / 560, 12)
    expect(moviesById.get(String(movieOnlyInCf))).toBeCloseTo(0.5 / 61, 12)
    expect(moviesById.has(String(movies[501]))).toBe(false)
    expect(rankedGames.map(({ itemId }) => itemId)).toEqual(games.slice(0, 500))
    expect(rankedGames[0]?.score).toBeCloseTo(1 / 61, 12)
    expect(rankedMovies.filter(({ bonus }) => bonus !== 0)).toEqual([
      { itemId: movieOnlyInCf, score: 0.5 / 61, bonus: 0.5 },
    ])
  })
})
