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
    const findMany = jest.fn(async (filter: { status: unknown }) =>
      filter.status === EUserItemStatus.PLANNED
        ? [{ item: plannedId }]
        : positiveIds.map((item) => ({ item })),
    )
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
      { read: { findMany } } as unknown as UserItemRepository,
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
      findMany,
      readEligibleRecommendationItems,
      findRelation,
      readRelatedItemIds,
      loadLatestModel,
      positiveIds,
      plannedId,
    }
  }

  it.each([
    { anyOf: [EUserItemStatus.PLANNED], isPromoted: false, queries: 1 },
    {
      anyOf: ["outside", EUserItemStatus.PLANNED],
      isPromoted: true,
      queries: 2,
    },
    { anyOf: ["outside"], isPromoted: false, queries: 1 },
    { anyOf: [], isPromoted: false, queries: 0 },
  ] as const)(
    "читает planned для бонуса только в смешанном режиме $anyOf",
    async ({ anyOf, isPromoted, queries }) => {
      const { read, findMany, loadLatestModel, plannedId } = setup()
      loadLatestModel.mockResolvedValue(null)

      const sources = await read({ filter: { library: { anyOf: [...anyOf] } } })

      expect(findMany).toHaveBeenCalledTimes(queries)
      expect(sources?.plannedIds?.has(plannedId.toHexString()) ?? false).toBe(
        isPromoted,
      )
      expect(sources?.personalByType).toBeUndefined()
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
      trainedAt: new Date(),
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
