import { beforeAll, describe, expect, it } from "@jest/globals"

import type { HydratedDocument, Model } from "mongoose"

import { getTestDatabase } from "@infrastructure/database/__tests__/setup/setupDatabase"

import { Relation, RelationSchema } from "../../../schemas/relation.schema"
import { RelationRepository } from "../core/relation.repository"

describe("RelationRepository", () => {
  let repository: RelationRepository

  beforeAll(() => {
    const model = getTestDatabase().connection.model(
      Relation.name,
      RelationSchema,
    ) as unknown as Model<HydratedDocument<Relation>>
    repository = new RelationRepository(model)
  })

  it("сохраняет запись и читает её по ключу связи", async () => {
    const key = "sequel"
    const created = await repository.write.create({
      key,
      name: { en: "Sequel", ru: null },
    })

    await expect(repository.read.findOne({ key })).resolves.toMatchObject({
      _id: created._id,
      key,
    })
  })
})
