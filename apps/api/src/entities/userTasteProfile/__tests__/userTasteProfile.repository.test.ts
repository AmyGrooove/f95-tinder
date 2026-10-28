import { beforeEach, describe, expect, it, jest } from "@jest/globals"
import { model, mongo, Types } from "mongoose"
import type { HydratedDocument, Model } from "mongoose"

import { UserTasteProfileSchema } from "../schemas/userTasteProfile.schema"
import type { UserTasteProfile } from "../schemas/userTasteProfile.schema"
import { UserTasteProfileRepository } from "../services/userTasteProfile.repository"

describe("UserTasteProfileRepository", () => {
  const userId = new Types.ObjectId()
  const affected = new Types.ObjectId()
  const unrelated = new Types.ObjectId()
  const ProfileModel = model<UserTasteProfile>(
    "TasteProfileRepositoryUnit",
    UserTasteProfileSchema,
  )
  const repository = new UserTasteProfileRepository(
    ProfileModel as unknown as Model<HydratedDocument<UserTasteProfile>>,
  )
  const previousPreferences = [
    { tag: affected, weight: -0.5, count: 2, explicitWeight: -0.4 },
    { tag: unrelated, weight: 0.7, count: 8, explicitWeight: 0.3 },
  ]

  beforeEach(() => {
    jest
      .spyOn(repository.write, "create")
      .mockImplementation(async (payload) => {
        return new ProfileModel(payload)
      })
    jest
      .spyOn(repository.write, "updateByFilter")
      .mockResolvedValue(new ProfileModel({ user: userId }))
  })

  it("заменяет расчёт затронутого тега, сохраняя его явный вес и посторонние предпочтения", async () => {
    await expect(
      repository.tryReplaceCalculatedPreferences({
        userId,
        tagIds: [affected],
        preferences: [{ tag: affected, weight: 0.5, count: 1 }],
        previousPreferences,
      }),
    ).resolves.toBe(true)

    expect(repository.write.updateByFilter).toHaveBeenCalledWith(
      {
        user: userId,
        $expr: { $eq: [{ $literal: previousPreferences }, "$tagPreferences"] },
      },
      {
        $set: {
          tagPreferences: [
            { tag: affected, weight: 0.5, count: 1, explicitWeight: -0.4 },
            previousPreferences[1],
          ],
        },
      },
    )
    expect(previousPreferences[0]).toEqual({
      tag: affected,
      weight: -0.5,
      count: 2,
      explicitWeight: -0.4,
    })
    expect(repository.write.create).not.toHaveBeenCalled()
  })

  it.each([0, 0.6])(
    "удаляет последний расчёт затронутого тега с явным весом %s, сохраняя посторонний тег",
    async (explicitWeight) => {
      await repository.tryReplaceCalculatedPreferences({
        userId,
        tagIds: [affected],
        preferences: [],
        previousPreferences: [
          { ...previousPreferences[0], explicitWeight },
          previousPreferences[1],
        ],
      })

      const remaining =
        explicitWeight === 0
          ? [previousPreferences[1]]
          : [
              { tag: affected, weight: 0, count: 0, explicitWeight },
              previousPreferences[1],
            ]
      expect(repository.write.updateByFilter).toHaveBeenCalledWith(
        expect.anything(),
        { $set: { tagPreferences: remaining } },
      )
    },
  )

  it("сообщает о конфликте, когда профиль изменился после исходного снимка", async () => {
    jest.mocked(repository.write.updateByFilter).mockResolvedValueOnce(null)

    await expect(
      repository.tryReplaceCalculatedPreferences({
        userId,
        tagIds: [affected],
        preferences: [],
        previousPreferences,
      }),
    ).resolves.toBe(false)

    expect(repository.write.create).not.toHaveBeenCalled()
  })

  it("не создаёт отсутствующий пустой профиль", async () => {
    await expect(
      repository.tryReplaceCalculatedPreferences({
        userId,
        tagIds: [affected],
        preferences: [],
        previousPreferences: null,
      }),
    ).resolves.toBe(true)

    expect(repository.write.create).not.toHaveBeenCalled()
    expect(repository.write.updateByFilter).not.toHaveBeenCalled()
  })

  it("создаёт первый профиль с рассчитанными предпочтениями", async () => {
    await expect(
      repository.tryReplaceCalculatedPreferences({
        userId,
        tagIds: [affected],
        preferences: [{ tag: affected, weight: 0.1, count: 1 }],
        previousPreferences: null,
      }),
    ).resolves.toBe(true)

    expect(repository.write.create).toHaveBeenCalledWith({
      user: userId,
      tagPreferences: [
        { tag: affected, weight: 0.1, count: 1, explicitWeight: 0 },
      ],
    })
    expect(repository.write.updateByFilter).not.toHaveBeenCalled()
  })

  it("возвращает конфликт при конкурентном создании профиля вместо перезаписи", async () => {
    jest.mocked(repository.write.create).mockRejectedValueOnce(
      new mongo.MongoServerError({
        code: 11000,
        keyPattern: { user: 1 },
      }),
    )

    await expect(
      repository.tryReplaceCalculatedPreferences({
        userId,
        tagIds: [affected],
        preferences: [{ tag: affected, weight: 0.1, count: 1 }],
        previousPreferences: null,
      }),
    ).resolves.toBe(false)
  })
})
