import { beforeAll, describe, expect, it } from "@jest/globals"
import { Types } from "mongoose"
import type { HydratedDocument, Model } from "mongoose"

import { getTestDatabase } from "@infrastructure/database/__tests__/setup/setupDatabase"

import { ItemStats, ItemStatsSchema } from "../../../schemas/itemStats.schema"
import { ItemStatsRepository } from "../core/itemStats.repository"

describe("ItemStatsRepository", () => {
  let repository: ItemStatsRepository
  let model: ConstructorParameters<typeof ItemStatsRepository>[0]

  beforeAll(() => {
    model = getTestDatabase().connection.model(
      ItemStats.name,
      ItemStatsSchema,
    ) as unknown as Model<HydratedDocument<ItemStats>>
    repository = new ItemStatsRepository(model)
  })

  it("накапливает изменения по одному тайтлу и обнуляет среднюю оценку после удаления всех оценок", async () => {
    const itemId = new Types.ObjectId()
    const session = await model.db.startSession()

    try {
      const props = {
        itemId,
        session,
        completedAttemptsCount: 1,
        ratingsCount: 1,
        favoritesCount: 1,
        statusCounts: { completed: 1 },
      }
      await expect(
        repository.applyChanges({ ...props, ratingDistribution: { six: 1 } }),
      ).resolves.toMatchObject({
        item: itemId,
        ratingAverage: 6,
        ratingsCount: 1,
        completedAttemptsCount: 1,
      })
      await expect(
        repository.applyChanges({ ...props, ratingDistribution: { ten: 1 } }),
      ).resolves.toMatchObject({
        ratingAverage: 8,
        ratingsCount: 2,
        favoritesCount: 2,
        statusCounts: { completed: 2 },
      })
      await expect(
        repository.applyChanges({
          ...props,
          ratingsCount: -2,
          completedAttemptsCount: 0,
          favoritesCount: 0,
          statusCounts: {},
          ratingDistribution: { six: -1, ten: -1 },
        }),
      ).resolves.toMatchObject({
        ratingAverage: null,
        ratingsCount: 0,
        completedAttemptsCount: 2,
      })
      await expect(model.countDocuments({ item: itemId }).exec()).resolves.toBe(
        1,
      )
    } finally {
      await session.endSession()
    }
  })

  it("отклоняет отрицательные счётчики, позволяя вызывающей стороне откатить транзакцию", async () => {
    const itemId = new Types.ObjectId()
    const session = await model.db.startSession()

    try {
      await expect(
        session.withTransaction(async () => {
          await repository.applyChanges({
            itemId,
            session,
            completedAttemptsCount: -1,
            ratingsCount: 0,
            favoritesCount: 0,
            ratingDistribution: {},
            statusCounts: {},
          })
        }),
      ).rejects.toMatchObject({ name: "ValidationError" })
      await expect(model.countDocuments({ item: itemId }).exec()).resolves.toBe(
        0,
      )
    } finally {
      await session.endSession()
    }
  })
})
