import { describe, expect, it, jest } from "@jest/globals"
import { BadRequestException, UnauthorizedException } from "@nestjs/common"
import { JwtService } from "@nestjs/jwt"
import { Test } from "@nestjs/testing"
import { Types, mongo, type HydratedDocument, type Model } from "mongoose"

import { AuthService } from "@endpoints/auth/services/authService"
import { FallbackRecommendationsService } from "@endpoints/recommendations/services/fallbackRecommendationsService"
import { RecommendationCandidatesService } from "@endpoints/recommendations/services/recommendationCandidatesService"
import type { IReadRecommendationCandidatesProps } from "@endpoints/recommendations/services/recommendationCandidatesService"
import { EItemType } from "@entities/item/schemas/EItemType"
import { ItemRepository } from "@entities/item/services/itemRepository"
import type { RecommendationModel } from "@entities/recommendationModel/schemas/RecommendationModel.schema"
import { RecommendationModelRepository } from "@entities/recommendationModel/services/recommendationModelRepository"
import { ECountry } from "@entities/shared/schemas/ECountry"
import { EMediaType } from "@entities/shared/schemas/EMediaType"
import type { SiteRatingsStatsRepository } from "@entities/siteStats/services/siteRatingsStatsRepository"
import type { UserRepository } from "@entities/user/services/userRepository"
import type { UserSession } from "@entities/userSession/schemas/userSession.schema"
import { UserSessionRepository } from "@entities/userSession/services/userSessionRepository"
import { CacheService } from "@infrastructure/cache/services/cacheService"
import { CursorService } from "@infrastructure/cache/services/cursorService"
import type { InfrastructureConfigService } from "@infrastructure/config/services/configService"
import type { MongoTransactionService } from "@infrastructure/database/services/mongoTransactionService"
import { SecurityJwtService } from "@infrastructure/security/services/jwtService"
import { requestContext } from "@shared/functions/context/requestContext"

import { RecommendationsService } from "../core/recommendations.service"
import { calculateAlsCandidates } from "../functions/calculateAlsCandidates"
import { calculateItemCfCandidates } from "../functions/calculateItemCfCandidates"
import { RecommendationCursorExpiredError } from "../static/RecommendationCursorExpiredError"

describe("RecommendationsService", () => {
  const setup = () => {
    const userId = new Types.ObjectId()
    const session = {
      _id: new Types.ObjectId(),
      user: userId,
      expiresAt: new Date(Date.now() + 60_000),
      country: ECountry.GEORGIA,
    }
    const findOne = jest.fn(
      (filter: {
        _id?: Types.ObjectId
        user?: Types.ObjectId
        expiresAt?: { $gt: Date }
      }) => ({
        exec: async () =>
          filter._id?.equals(session._id) === true &&
          filter.user?.equals(session.user) === true &&
          filter.expiresAt !== undefined &&
          session.expiresAt > filter.expiresAt.$gt
            ? session
            : null,
      }),
    )
    const sessionRepository = new UserSessionRepository({
      findOne,
    } as unknown as Model<HydratedDocument<UserSession>>)
    const checkIsExists = jest
      .fn<UserRepository["read"]["checkIsExists"]>()
      .mockResolvedValue(true)
    const userRepository = {
      read: { checkIsExists },
    } as unknown as UserRepository
    const jwtService = new SecurityJwtService(new JwtService(), {
      app: { name: "recommendations-test" },
      jwt: { accessSecret: "recommendations-test-secret" },
    } as InfrastructureConfigService)
    const authService = new AuthService(
      userRepository,
      sessionRepository,
      {} as MongoTransactionService,
      jwtService,
    )
    const readAverage = jest
      .fn<SiteRatingsStatsRepository["readAverage"]>()
      .mockResolvedValue(7.25)
    const readPopularItemIds = jest.fn<ItemRepository["readPopularItemIds"]>()
    const readNewItemIds = jest.fn<ItemRepository["readNewItemIds"]>()
    const readPosterCardsByIds =
      jest.fn<ItemRepository["readPosterCardsByIds"]>()
    const readRecommendationPosterCards =
      jest.fn<ItemRepository["readRecommendationPosterCards"]>()
    const cache = new Map<string, unknown>()
    const cacheSet = jest.fn<CacheService["set"]>(async (key, value) => {
      cache.set(key, value)
    })
    const itemRepository = {
      readPopularItemIds,
      readNewItemIds,
      readPosterCardsByIds,
      readRecommendationPosterCards,
    } as unknown as ItemRepository
    const candidatesService = new RecommendationCandidatesService(
      authService,
      userRepository,
      itemRepository,
      { readAverage } as unknown as SiteRatingsStatsRepository,
    )
    const service = new RecommendationsService(
      candidatesService,
      new FallbackRecommendationsService(candidatesService),
      itemRepository,
      {
        get: async <TValue>(key: string) => (cache.get(key) as TValue) ?? null,
        set: cacheSet,
      } satisfies Pick<CacheService, "get" | "set"> as unknown as CacheService,
      new CursorService(),
    )
    const signToken = (sessionId = session._id, subject = userId) =>
      jwtService.signAccessToken({
        sub: subject.toHexString(),
        sessionId: sessionId.toHexString(),
        role: "user",
      })

    return {
      service,
      session,
      userId,
      signToken,
      findOne,
      checkIsExists,
      readAverage,
      readPopularItemIds,
      readNewItemIds,
      readPosterCardsByIds,
      readRecommendationPosterCards,
      cache,
      cacheSet,
    }
  }

  it("возвращает ID каталога и передаёт проверенного пользователя, страну сессии, фильтры и среднее по сайту с лимитом 20", async () => {
    const {
      service,
      session,
      userId,
      signToken,
      findOne,
      checkIsExists,
      readAverage,
      readPopularItemIds,
    } = setup()
    const props: IReadRecommendationCandidatesProps = {
      type: EItemType.GAME,
      filter: {
        library: { anyOf: ["outside"] },
        tags: [{ noneOf: [new Types.ObjectId()] }],
        rating: { min: 6, max: 9 },
      },
    }
    const itemIds = [new Types.ObjectId(), new Types.ObjectId()]
    readPopularItemIds.mockResolvedValue(itemIds)
    const token = await signToken()

    await requestContext.run(
      { requestId: "recommendations", method: "QUERY", path: "/" },
      async () => {
        await expect(service.readPopularItemIds(token, props)).resolves.toEqual(
          itemIds,
        )
        expect(requestContext.get("userId")).toBe(userId.toHexString())
      },
    )
    expect(findOne.mock.calls[0]?.[0]).toEqual({
      _id: session._id,
      user: userId,
      expiresAt: { $gt: expect.any(Date) },
    })
    expect(checkIsExists).toHaveBeenCalledWith({ _id: userId })
    expect(readAverage).toHaveBeenCalledTimes(1)
    expect(readPopularItemIds).toHaveBeenCalledWith({
      type: props.type,
      limit: 20,
      userId,
      country: session.country,
      siteRatingAverage: 7.25,
      ...props.filter,
    })
  })

  it("передаёт заданный лимит и отсутствие среднего по сайту", async () => {
    const { service, signToken, readAverage, readPopularItemIds } = setup()
    readAverage.mockResolvedValue(null)
    readPopularItemIds.mockResolvedValue([])

    await expect(
      service.readPopularItemIds(await signToken(), {
        type: EItemType.MOVIE,
        limit: 10,
      }),
    ).resolves.toEqual([])
    expect(readPopularItemIds).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 10, siteRatingAverage: null }),
    )
  })

  it("передаёт новинкам включительное окно в 90 дней до текущего момента и страну сессии", async () => {
    const { service, signToken, userId, session, readNewItemIds } = setup()
    const through = new Date("2026-10-01T12:00:00.000Z")
    readNewItemIds.mockResolvedValue([])
    jest.useFakeTimers({ now: through, doNotFake: ["nextTick"] })

    try {
      session.expiresAt = new Date(through.getTime() + 60_000)
      await expect(
        service.readNewItemIds(await signToken(), { type: EItemType.MOVIE }),
      ).resolves.toEqual([])
      expect(readNewItemIds).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          country: session.country,
          releaseWindow: {
            from: new Date("2026-07-03T12:00:00.000Z"),
            through,
          },
        }),
      )
    } finally {
      jest.useRealTimers()
    }
  })

  it("загружает карточки fallback в порядке собранных ID и возвращает доступные карточки", async () => {
    const {
      service,
      signToken,
      readPopularItemIds,
      readNewItemIds,
      readPosterCardsByIds,
    } = setup()
    const first = new Types.ObjectId()
    const missing = new Types.ObjectId()
    const last = new Types.ObjectId()
    const type = EItemType.MOVIE
    const cards = [
      { _id: first, type, title: { ru: "Первый", en: null }, media: [] },
      {
        _id: last,
        type,
        title: { ru: "Последний", en: null },
        media: [
          { src: "/poster.jpg", language: null, type: EMediaType.POSTER },
        ],
      },
    ] satisfies Awaited<ReturnType<ItemRepository["readPosterCardsByIds"]>>
    readPopularItemIds.mockResolvedValue([first, last])
    readNewItemIds.mockResolvedValue([missing])
    readPosterCardsByIds.mockResolvedValue(cards)

    await expect(
      service.readFallbackItems(await signToken(), { types: [type] }),
    ).resolves.toEqual(cards)
    expect(readPosterCardsByIds).toHaveBeenCalledWith([first, missing, last])
  })

  it("продолжает исходный порядок fallback без сдвига порций и продления TTL после исключения карточек", async () => {
    const {
      service,
      signToken,
      userId,
      session,
      readPopularItemIds,
      readNewItemIds,
      readRecommendationPosterCards,
      cacheSet,
    } = setup()
    const type = EItemType.MOVIE
    const filter = { types: [type] }
    const popular = Array.from({ length: 23 }, () => new Types.ObjectId())
    const newRelease = new Types.ObjectId()
    readPopularItemIds.mockResolvedValue(popular)
    readNewItemIds.mockResolvedValue([newRelease, popular[0]])
    const excluded = new Set<string>()
    readRecommendationPosterCards.mockImplementation(async ({ ids }) => {
      return ids
        .filter((id) => !excluded.has(id.toHexString()))
        .map((_id) => ({
          _id,
          type,
          title: { ru: "Фильм", en: null },
          media: [],
        }))
    })
    const token = await signToken()
    const first = await service.readFallbackPage(token, { limit: 10, filter })

    expect(first.items.map((item) => item._id)).toEqual([
      popular[0],
      newRelease,
      ...popular.slice(1, 9),
    ])
    expect(first.count).toBe(10)
    if (first.nextCursor === null) {
      throw new Error("Ожидался курсор второй порции")
    }

    excluded.add(popular[9].toHexString())
    const replacement = new Types.ObjectId()
    readPopularItemIds.mockResolvedValue([replacement])
    const second = await service.readFallbackPage(token, {
      cursor: first.nextCursor,
      limit: 10,
      filter,
    })

    expect(readRecommendationPosterCards).toHaveBeenLastCalledWith({
      ...filter,
      ids: popular.slice(9, 19),
      userId,
      country: session.country,
    })
    expect(second.items.map((item) => item._id)).toEqual(popular.slice(10, 19))
    expect(second.count).toBe(9)
    if (second.nextCursor === null) {
      throw new Error("Ожидался курсор третьей порции")
    }

    const third = await service.readFallbackPage(token, {
      cursor: second.nextCursor,
      limit: 10,
      filter,
    })
    expect(third.items.map((item) => item._id)).toEqual(popular.slice(19))
    expect(third).toMatchObject({ count: 4, nextCursor: null })
    expect(readPopularItemIds).toHaveBeenCalledTimes(1)
    expect(cacheSet).toHaveBeenCalledTimes(1)
    expect(cacheSet).toHaveBeenCalledWith(
      expect.any(String),
      { itemIds: [popular[0], newRelease, ...popular.slice(1)].map(String) },
      600_000,
    )

    const fresh = await service.readFallbackPage(token, { limit: 10, filter })
    expect(fresh.items.map((item) => item._id)).toEqual([
      replacement,
      newRelease,
      popular[0],
    ])
    expect(fresh).toMatchObject({ count: 3, nextCursor: null })
    expect(readPopularItemIds).toHaveBeenCalledTimes(2)
  })

  it("отклоняет курсор другого размера порции и сообщает об исчезнувшем списке без повторной сборки", async () => {
    const {
      service,
      signToken,
      readPopularItemIds,
      readNewItemIds,
      readRecommendationPosterCards,
      cache,
    } = setup()
    readPopularItemIds.mockResolvedValue(
      Array.from({ length: 11 }, () => new Types.ObjectId()),
    )
    readNewItemIds.mockResolvedValue([])
    readRecommendationPosterCards.mockResolvedValue([])
    const token = await signToken()
    const filter = { types: [EItemType.MOVIE] }
    const { nextCursor } = await service.readFallbackPage(token, {
      limit: 10,
      filter,
    })
    if (nextCursor === null) {
      throw new Error("Ожидался курсор второй порции")
    }

    await expect(
      service.readFallbackPage(token, { cursor: nextCursor, filter }),
    ).rejects.toThrow(BadRequestException)

    cache.clear()
    await expect(
      service.readFallbackPage(token, {
        cursor: nextCursor,
        limit: 10,
        filter,
      }),
    ).rejects.toThrow(RecommendationCursorExpiredError)
    expect(readPopularItemIds).toHaveBeenCalledTimes(1)
    expect(readRecommendationPosterCards).toHaveBeenCalledTimes(1)
  })

  it("стабильно чередует типы и привязывает курсор к пользователю, стране, фильтру и режиму выдачи", async () => {
    const {
      service,
      signToken,
      session,
      userId,
      readPopularItemIds,
      readNewItemIds,
      readRecommendationPosterCards,
    } = setup()
    const movies = Array.from({ length: 13 }, () => new Types.ObjectId())
    const games = Array.from({ length: 2 }, () => new Types.ObjectId())
    readPopularItemIds.mockImplementation(async ({ type }) =>
      type === EItemType.MOVIE ? movies : games,
    )
    readNewItemIds.mockResolvedValue([])
    readRecommendationPosterCards.mockImplementation(async ({ ids }) =>
      ids.map((_id) => ({
        _id,
        type: movies.some((id) => id.equals(_id))
          ? EItemType.MOVIE
          : EItemType.GAME,
        title: { ru: "Произведение", en: null },
        media: [],
      })),
    )
    const token = await signToken()
    const filter = { types: [EItemType.GAME, EItemType.MOVIE] }
    const first = await service.readFallbackPage(token, { limit: 10, filter })
    expect(first.items.map(({ _id }) => _id)).toEqual([
      movies[0],
      games[0],
      movies[1],
      games[1],
      ...movies.slice(2, 8),
    ])
    if (first.nextCursor === null) {
      throw new Error("Ожидался курсор второй порции")
    }
    const props = { cursor: first.nextCursor, limit: 10, filter } as const
    const continued = await service.readFallbackPage(token, {
      ...props,
      filter: { types: [EItemType.MOVIE, EItemType.GAME] },
    })
    expect(continued.items.map(({ _id }) => _id)).toEqual(movies.slice(8))

    await expect(
      service.readFallbackPage(token, {
        ...props,
        filter: { ...filter, rating: { min: 8 } },
      }),
    ).rejects.toThrow(BadRequestException)
    const readSources = jest.fn(async () => ({}))
    await expect(
      service.readFeedPage(token, props, readSources),
    ).rejects.toThrow(BadRequestException)
    expect(readSources).not.toHaveBeenCalled()

    session.user = new Types.ObjectId()
    const otherToken = await signToken(session._id, session.user)
    await expect(service.readFallbackPage(otherToken, props)).rejects.toThrow(
      BadRequestException,
    )

    session.user = userId
    session.country = ECountry.ARMENIA
    await expect(service.readFallbackPage(token, props)).rejects.toThrow(
      BadRequestException,
    )
    expect(readPopularItemIds).toHaveBeenCalledTimes(2)
    expect(readRecommendationPosterCards).toHaveBeenCalledTimes(2)
  })

  it("читает последнюю BSON-модель, сохраняет порядок при равных scores и исключает положительную историю", async () => {
    const _id = new Types.ObjectId()
    const trainedAt = new Date()
    const itemIds = Array.from({ length: 4 }, () =>
      new Types.ObjectId().toHexString(),
    )
    const buffers = {
      offsets: Buffer.from("0000000002000000020000000200000002000000", "hex"),
      indices: Buffer.from("0100000002000000", "hex"),
      weights: Buffer.from("0000003f0000803e", "hex"),
      itemFactors: Buffer.from("0000803f0000803f0000003f00000000", "hex"),
      popularity: Buffer.from("0000803f000000400000404000000040", "hex"),
    }
    const bson = mongo.BSON.serialize({
      _id,
      trainedAt,
      formatVersion: 1,
      itemIds,
      itemCF: {
        offsets: buffers.offsets,
        indices: buffers.indices,
        weights: buffers.weights,
      },
      als: {
        factors: 1,
        alpha: 2,
        regularization: 1,
        itemFactors: buffers.itemFactors,
      },
      popularity: buffers.popularity,
    })
    const options: mongo.BSON.DeserializeOptions = {}
    const exec = jest.fn<RecommendationModelRepository["readLatest"]>(
      async () => mongo.BSON.deserialize(bson, options),
    )
    const lean = jest.fn(() => ({ exec }))
    const setOptions = jest.fn((value: typeof options) => {
      Object.assign(options, value)
      return { lean }
    })
    const sort = jest.fn<
      (order: Record<string, number>) => { setOptions: typeof setOptions }
    >(() => ({ setOptions }))
    const repository = new RecommendationModelRepository({
      findOne: () => ({ sort }),
    } as unknown as Model<RecommendationModel>)
    const moduleRef = await Test.createTestingModule({
      providers: [
        RecommendationsService,
        CursorService,
        { provide: RecommendationModelRepository, useValue: repository },
        { provide: RecommendationCandidatesService, useValue: {} },
        { provide: FallbackRecommendationsService, useValue: {} },
        { provide: ItemRepository, useValue: {} },
        { provide: CacheService, useValue: {} },
      ],
    }).compile()

    try {
      const service = moduleRef.get(RecommendationsService)
      const model = await service.loadLatestModel()
      expect(sort).toHaveBeenCalledWith({ trainedAt: -1, _id: -1 })
      expect(lean).toHaveBeenCalledTimes(1)
      expect(model).toMatchObject({ id: _id.toHexString(), trainedAt, itemIds })
      if (model === null) {
        throw new Error("Ожидалась загруженная модель")
      }

      const [known, first, second, third] = itemIds
      for (const calculate of [
        calculateItemCfCandidates,
        calculateAlsCandidates,
      ]) {
        expect(calculate(model, [])).toEqual(
          [second, first, third, known].map((itemId) => ({ itemId, score: 0 })),
        )
        const candidates = calculate(model, [known, known, "unknown"])
        expect(candidates.map(({ itemId }) => itemId)).toEqual([
          first,
          second,
          third,
        ])
        expect(candidates[0].score).toBeGreaterThan(candidates[1].score)
        expect(candidates[2].score).toBe(0)
      }
      expect(calculateItemCfCandidates(model, [known])[0].score).toBe(0.5)
      expect(calculateAlsCandidates(model, [known])[0].score).toBeCloseTo(
        2 / (2 + 1 + 0.25 + 1),
        7,
      )

      exec.mockResolvedValueOnce(null)
      await expect(service.loadLatestModel()).resolves.toBeNull()

      exec.mockImplementationOnce(async () => ({
        ...mongo.BSON.deserialize(bson, options),
        als: {
          factors: 1,
          alpha: 2,
          regularization: 1,
          itemFactors: Buffer.alloc(0),
        },
      }))
      await expect(service.loadLatestModel()).rejects.toThrow(
        "Некорректные параметры или размеры массивов ALS",
      )
    } finally {
      await moduleRef.close()
    }
  })

  it("отклоняет недействительный токен до чтения сессии, пользователя, среднего и каталога", async () => {
    const { service, findOne, checkIsExists, readAverage, readPopularItemIds } =
      setup()

    await expect(
      service.readPopularItemIds("invalid-token", { type: EItemType.GAME }),
    ).rejects.toThrow(UnauthorizedException)
    expect(findOne).not.toHaveBeenCalled()
    expect(checkIsExists).not.toHaveBeenCalled()
    expect(readAverage).not.toHaveBeenCalled()
    expect(readPopularItemIds).not.toHaveBeenCalled()
  })

  it.each([
    {
      reason: "отсутствующей сессии",
      prepare: ({ signToken }: ReturnType<typeof setup>) =>
        signToken(new Types.ObjectId()),
    },
    {
      reason: "просроченной сессии",
      prepare: ({ session, signToken }: ReturnType<typeof setup>) => {
        session.expiresAt = new Date(0)
        return signToken()
      },
    },
    {
      reason: "чужой сессии",
      prepare: ({ session, signToken }: ReturnType<typeof setup>) => {
        session.user = new Types.ObjectId()
        return signToken()
      },
    },
    {
      reason: "отсутствующем пользователе",
      prepare: ({ checkIsExists, signToken }: ReturnType<typeof setup>) => {
        checkIsExists.mockResolvedValue(false)
        return signToken()
      },
    },
  ])(
    "отказывает при $reason до чтения среднего и каталога",
    async ({ prepare }) => {
      const fixture = setup()
      const { service, readAverage, readPopularItemIds } = fixture
      const token = await prepare(fixture)

      await expect(
        service.readPopularItemIds(token, { type: EItemType.GAME }),
      ).rejects.toThrow(UnauthorizedException)
      expect(readAverage).not.toHaveBeenCalled()
      expect(readPopularItemIds).not.toHaveBeenCalled()
    },
  )
})
