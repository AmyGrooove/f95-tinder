import { beforeAll, describe, expect, it } from "@jest/globals"
import { Types } from "mongoose"

import { EUserItemStatus } from "@entities/userItem/schemas/EUserItemStatus"
import { getTestDatabase } from "@infrastructure/database/__tests__/setup/setupDatabase"

import { EUserItemHistoryEvent } from "../../../schemas/EUserItemHistoryEvent"
import {
  UserItemHistory,
  UserItemHistorySchema,
} from "../../../schemas/userItemHistory.schema"
import { UserItemHistoryRepository } from "../core/userItemHistory.repository"

describe("UserItemHistoryRepository", () => {
  let repository: UserItemHistoryRepository
  let model: ConstructorParameters<typeof UserItemHistoryRepository>[0]

  beforeAll(() => {
    model = getTestDatabase().connection.model<UserItemHistory>(
      UserItemHistory.name,
      UserItemHistorySchema,
    )
    repository = new UserItemHistoryRepository(model)
  })

  it("добавляет события в переданной транзакции и игнорирует пустой пакет", async () => {
    const user = new Types.ObjectId()
    const item = new Types.ObjectId()
    const event = {
      user,
      item,
      type: EUserItemHistoryEvent.ADDED,
      status: EUserItemStatus.PLANNED,
    } as const
    const session = await model.db.startSession()

    try {
      await session.withTransaction(async () => {
        await repository.append([], session)
        await repository.append([event], session)
        await expect(
          repository.readPage({ userId: user, limit: 10 }),
        ).resolves.toEqual([])
        await expect(
          model.countDocuments({ user }).session(session).exec(),
        ).resolves.toBe(1)
      })
    } finally {
      await session.endSession()
    }

    await expect(
      repository.readPage({ userId: user, limit: 10 }),
    ).resolves.toEqual([
      expect.objectContaining({
        item,
        type: EUserItemHistoryEvent.ADDED,
        status: EUserItemStatus.PLANNED,
      }),
    ])
  })

  it("ограничивает историю владельцем и продолжает страницу на совпадающем времени по id", async () => {
    const user = new Types.ObjectId()
    const item = new Types.ObjectId()
    const [old, first, second, third] = ["1", "2", "3", "4"].map(
      (digit) => new Types.ObjectId(digit.padStart(24, "0")),
    )
    const createdAt = new Date("2026-02-02")
    const event = {
      item,
      type: EUserItemHistoryEvent.RATING_CHANGED,
      rating: null,
    }
    await model.collection.insertMany([
      { ...event, _id: second, user, createdAt },
      { ...event, _id: old, user, createdAt: new Date("2026-02-01") },
      { ...event, _id: third, user, createdAt },
      { ...event, _id: first, user, createdAt },
      { ...event, user: new Types.ObjectId(), createdAt },
    ])

    const page = await repository.readPage({ userId: user, limit: 2 })
    expect(page.map(({ _id }) => _id)).toEqual([third, second, first])
    const tail = await repository.readPage({
      userId: user,
      limit: 2,
      after: { createdAt, id: second },
    })
    expect(tail.map(({ _id }) => _id)).toEqual([first, old])
  })
})
