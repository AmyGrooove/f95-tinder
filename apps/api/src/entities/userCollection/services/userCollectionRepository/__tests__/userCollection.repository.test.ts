import { describe, expect, it, jest } from "@jest/globals"
import { mongo, Types } from "mongoose"

import { UserCollectionRepository } from "../core/userCollection.repository"

describe("UserCollectionRepository", () => {
  const createRepository = () =>
    new UserCollectionRepository(
      {} as ConstructorParameters<typeof UserCollectionRepository>[0],
    )

  it("ограничивает чтение реакции пользователем и коллекцией", async () => {
    const repository = createRepository()
    const find = jest.spyOn(repository.read, "findOne").mockResolvedValue(null)
    const userId = new Types.ObjectId()
    const collectionId = new Types.ObjectId()

    await expect(
      repository.findByUserAndCollection(userId, collectionId),
    ).resolves.toBeNull()
    expect(find).toHaveBeenCalledWith(
      { user: userId, collectionId },
      { _id: 0, isFavorite: 1, isHidden: 1, rating: 1 },
    )
  })

  it("возвращает строковые id избранных коллекций пользователя", async () => {
    const repository = createRepository()
    const userId = new Types.ObjectId()
    const collectionId = new Types.ObjectId()
    const find = jest
      .spyOn(repository.read, "findMany")
      .mockResolvedValue([{ collectionId }] as Awaited<
        ReturnType<typeof repository.read.findMany>
      >)

    await expect(repository.readFavoriteCollectionIds(userId)).resolves.toEqual(
      [collectionId.toHexString()],
    )
    expect(find).toHaveBeenCalledWith(
      { user: userId, isFavorite: true },
      { _id: 0, collectionId: 1 },
      { lean: true },
    )
  })

  it("возвращает нулевую статистику для коллекции без реакций", async () => {
    const repository = createRepository()
    const aggregate = jest
      .spyOn(repository.aggregation, "aggregate")
      .mockResolvedValue([])
    const collectionId = new Types.ObjectId()

    await expect(repository.readStatistics(collectionId)).resolves.toEqual({
      ratingAverage: null,
      ratingsCount: 0,
      favoritesCount: 0,
    })
    expect(aggregate).toHaveBeenCalledWith(
      expect.arrayContaining([{ $match: { collectionId } }]),
    )
  })

  it("повторяет обновление без вставки при гонке за уникальную пару", async () => {
    const repository = createRepository()
    const error = new mongo.MongoServerError({
      code: 11000,
      keyPattern: { user: 1, collectionId: 1 },
    })
    const reaction = { isFavorite: false, rating: null }
    const row = reaction as Awaited<
      ReturnType<typeof repository.write.updateByFilter>
    >
    const update = jest
      .spyOn(repository.write, "updateByFilter")
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce(row)
    const userId = new Types.ObjectId()
    const collectionId = new Types.ObjectId()
    const filter = { user: userId, collectionId }
    const projection = { _id: 0, isFavorite: 1, rating: 1, isHidden: 1 }

    await expect(
      repository.upsertReaction({ userId, collectionId, reaction }),
    ).resolves.toBe(row)
    expect(update).toHaveBeenCalledTimes(2)
    expect(update).toHaveBeenNthCalledWith(
      1,
      filter,
      { $set: reaction },
      { upsert: true, setDefaultsOnInsert: true, projection },
    )
    expect(update).toHaveBeenNthCalledWith(
      2,
      filter,
      { $set: reaction },
      { projection },
    )
  })

  it.each([
    new Error("Ошибка записи"),
    new mongo.MongoServerError({ code: 11000, keyPattern: { _id: 1 } }),
  ])(
    "передаёт ошибку, не связанную с гонкой за уникальную пару",
    async (error) => {
      const repository = createRepository()
      const update = jest
        .spyOn(repository.write, "updateByFilter")
        .mockRejectedValue(error)

      await expect(
        repository.upsertReaction({
          userId: new Types.ObjectId(),
          collectionId: new Types.ObjectId(),
          reaction: { rating: 7 },
        }),
      ).rejects.toBe(error)
      expect(update).toHaveBeenCalledTimes(1)
    },
  )
})
