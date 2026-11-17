import { describe, expect, it, jest } from "@jest/globals"
import { Types } from "mongoose"

import type { RecommendationCandidatesService } from "@endpoints/recommendations/services/recommendationCandidatesService"
import { EItemType } from "@entities/item/schemas/EItemType"
import { ECountry } from "@entities/shared/schemas/ECountry"

import { FallbackRecommendationsService } from "../core/fallbackRecommendations.service"

describe("FallbackRecommendationsService", () => {
  const setup = (popular: Types.ObjectId[], newReleases: Types.ObjectId[]) => {
    const readPopularItemIds = jest
      .fn<RecommendationCandidatesService["readPopularItemIds"]>()
      .mockResolvedValue(popular)
    const readNewItemIds = jest
      .fn<RecommendationCandidatesService["readNewItemIds"]>()
      .mockResolvedValue(newReleases)
    const service = new FallbackRecommendationsService({
      readPopularItemIds,
      readNewItemIds,
    } as unknown as RecommendationCandidatesService)
    const context = {
      userId: new Types.ObjectId(),
      country: ECountry.GEORGIA,
      siteRatingAverage: null,
    }
    const props = { type: EItemType.MOVIE }

    return {
      read: (sources?: Parameters<typeof service.readItemIds>[2]) =>
        service.readItemIds(context, props, sources),
    }
  }

  it("берёт 60 популярных и 40 новых произведений в список из 100", async () => {
    const popular = Array.from({ length: 100 }, () => new Types.ObjectId())
    const newReleases = Array.from({ length: 100 }, () => new Types.ObjectId())

    await expect(setup(popular, newReleases).read()).resolves.toEqual(
      Array.from({ length: 20 }, (_, index) => [
        popular[3 * index],
        newReleases[2 * index],
        popular[3 * index + 1],
        newReleases[2 * index + 1],
        popular[3 * index + 2],
      ]).flat(),
    )
  })

  it("берёт 70 личных, 20 новых и 10 популярных произведений в список из 100", async () => {
    const popular = Array.from({ length: 100 }, () => new Types.ObjectId())
    const newReleases = Array.from({ length: 100 }, () => new Types.ObjectId())
    const personal = Array.from({ length: 100 }, () => new Types.ObjectId())
    const result = await setup(popular, newReleases).read({
      personal: personal.map((itemId) => ({ itemId, score: 1 })),
    })

    expect(result).toHaveLength(100)
    expect(result.filter((id) => personal.includes(id))).toEqual(
      personal.slice(0, 70),
    )
    expect(result.filter((id) => newReleases.includes(id))).toEqual(
      newReleases.slice(0, 20),
    )
    expect(result.filter((id) => popular.includes(id))).toEqual(
      popular.slice(0, 10),
    )
  })

  it("убирает одинаковые ID из всех каналов и заполняет свободные места доступными кандидатами", async () => {
    const [shared, recent, popular, personal] = Array.from(
      { length: 4 },
      () => new Types.ObjectId(),
    )
    const duplicate = () => new Types.ObjectId(shared.toHexString())

    await expect(
      setup([duplicate(), popular], [duplicate(), recent]).read({
        personal: [
          { itemId: shared, score: 2 },
          { itemId: personal, score: 1 },
        ],
      }),
    ).resolves.toEqual([shared, recent, personal, popular])
  })

  it("применяет ровно 5% к planned в популярных и новинках и больший бонус в личном канале", async () => {
    const popular = Array.from({ length: 5 }, () => new Types.ObjectId())
    const newReleases = Array.from({ length: 5 }, () => new Types.ObjectId())
    const [both, benchmark, planned] = Array.from(
      { length: 3 },
      () => new Types.ObjectId(),
    )

    const result = await setup(popular, newReleases).read({
      plannedIds: new Set(
        [
          popular[3],
          popular[4],
          newReleases[3],
          newReleases[4],
          both,
          planned,
        ].map(String),
      ),
      personal: [
        { itemId: both, score: 1, bonus: 0.5 },
        { itemId: benchmark, score: 1.525 },
        { itemId: planned, score: 1.44 },
      ],
    })

    expect(
      result.filter((id) => [both, benchmark, planned].includes(id)),
    ).toEqual([benchmark, planned, both])
    expect(result.filter((id) => popular.includes(id))).toEqual([
      popular[3],
      popular[0],
      popular[4],
      popular[1],
      popular[2],
    ])
    expect(result.filter((id) => newReleases.includes(id))).toEqual([
      newReleases[3],
      newReleases[0],
      newReleases[4],
      newReleases[1],
      newReleases[2],
    ])
  })
})
