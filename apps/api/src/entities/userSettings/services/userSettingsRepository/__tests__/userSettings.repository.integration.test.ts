import { beforeAll, describe, expect, it } from "@jest/globals"
import { Types } from "mongoose"
import type { HydratedDocument, Model } from "mongoose"

import { getTestDatabase } from "@infrastructure/database/__tests__/setup/setupDatabase"

import {
  UserSettings,
  UserSettingsSchema,
} from "../../../schemas/userSettings.schema"
import { UserSettingsRepository } from "../core/userSettings.repository"

describe("UserSettingsRepository", () => {
  let repository: UserSettingsRepository

  beforeAll(() => {
    const model = getTestDatabase().connection.model(
      UserSettings.name,
      UserSettingsSchema,
    ) as unknown as Model<HydratedDocument<UserSettings>>
    repository = new UserSettingsRepository(model)
  })

  it("сохраняет запись и читает её по пользователю", async () => {
    const user = new Types.ObjectId()
    const created = await repository.write.create({ user })

    await expect(repository.read.findOne({ user })).resolves.toMatchObject({
      _id: created._id,
      user,
    })
  })
})
