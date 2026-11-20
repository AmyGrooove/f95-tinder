import { beforeAll, describe, expect, it } from "@jest/globals"
import { Types } from "mongoose"

import { getTestDatabase } from "@infrastructure/database/__tests__/setup/setupDatabase"

import {
  RecommendationModel,
  RecommendationModelSchema,
} from "../../../schemas/RecommendationModel.schema"
import { RecommendationModelRepository } from "../core/recommendationModel.repository"

describe("RecommendationModelRepository", () => {
  let repository: RecommendationModelRepository
  let model: ConstructorParameters<typeof RecommendationModelRepository>[0]

  beforeAll(() => {
    model = getTestDatabase().connection.model<RecommendationModel>(
      RecommendationModel.name,
      RecommendationModelSchema,
    )
    repository = new RecommendationModelRepository(model)
  })

  it("возвращает null при отсутствии модели", async () => {
    await expect(repository.readLatest()).resolves.toBeNull()
  })

  it("читает новый артефакт по дате обучения и id с бинарными полями в Buffer", async () => {
    const trainedAt = new Date("2026-01-02")
    const lowerId = new Types.ObjectId("000000000000000000000001")
    const latestId = new Types.ObjectId("000000000000000000000002")
    const olderId = new Types.ObjectId("000000000000000000000003")
    const popularity = Buffer.from([1, 2, 3, 4])
    await model.collection.insertMany([
      { _id: latestId, trainedAt, popularity },
      { _id: olderId, trainedAt: new Date("2026-01-01"), popularity },
      { _id: lowerId, trainedAt, popularity },
    ])

    await expect(repository.readLatest()).resolves.toMatchObject({
      _id: latestId,
      popularity,
    })
  })
})
