import { beforeAll, describe, expect, it } from "@jest/globals"
import { Types } from "mongoose"
import type { HydratedDocument, Model } from "mongoose"

import { getTestDatabase } from "@infrastructure/database/__tests__/setup/setupDatabase"

import { ItemBan, ItemBanSchema } from "../../../schemas/itemBan.schema"
import { ItemBanRepository } from "../core/itemBan.repository"

describe("ItemBanRepository", () => {
  let repository: ItemBanRepository

  beforeAll(() => {
    const model = getTestDatabase().connection.model(
      ItemBan.name,
      ItemBanSchema,
    ) as unknown as Model<HydratedDocument<ItemBan>>
    repository = new ItemBanRepository(model)
  })

  it("сохраняет запись и читает её по тайтлу", async () => {
    const item = new Types.ObjectId()
    const created = await repository.write.create({ item })

    await expect(repository.read.findOne({ item })).resolves.toMatchObject({
      _id: created._id,
      item,
    })
  })
})
