import { describe, expect, it, jest } from "@jest/globals"
import { UnauthorizedException } from "@nestjs/common"
import { JwtService } from "@nestjs/jwt"
import { Types, type HydratedDocument, type Model } from "mongoose"

import { AuthService } from "@endpoints/auth/services/authService"
import { FallbackRecommendationsService } from "@endpoints/recommendations/services/fallbackRecommendationsService"
import { RecommendationCandidatesService } from "@endpoints/recommendations/services/recommendationCandidatesService"
import type { IReadRecommendationCandidatesProps } from "@endpoints/recommendations/services/recommendationCandidatesService"
import { EItemType } from "@entities/item/schemas/EItemType"
import type { ItemRepository } from "@entities/item/services/itemRepository"
import { ECountry } from "@entities/shared/schemas/ECountry"
import { EMediaType } from "@entities/shared/schemas/EMediaType"
import type { SiteRatingsStatsRepository } from "@entities/siteStats/services/siteRatingsStatsRepository"
import type { UserRepository } from "@entities/user/services/userRepository"
import type { UserSession } from "@entities/userSession/schemas/userSession.schema"
import { UserSessionRepository } from "@entities/userSession/services/userSessionRepository"
import type { InfrastructureConfigService } from "@infrastructure/config/services/configService"
import type { MongoTransactionService } from "@infrastructure/database/services/mongoTransactionService"
import { SecurityJwtService } from "@infrastructure/security/services/jwtService"
import { requestContext } from "@shared/functions/context/requestContext"

import { RecommendationsService } from "../core/recommendations.service"

describe("RecommendationsService.readPopularItemIds", () => {
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
    const itemRepository = {
      readPopularItemIds,
      readNewItemIds,
      readPosterCardsByIds,
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
    )
    const signToken = (sessionId = session._id) =>
      jwtService.signAccessToken({
        sub: userId.toHexString(),
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
