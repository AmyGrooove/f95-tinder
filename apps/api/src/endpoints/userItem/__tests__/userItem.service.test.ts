import { beforeEach, describe, expect, it, jest } from "@jest/globals"
import { ConflictException, NotFoundException } from "@nestjs/common"
import { model, Types } from "mongoose"
import type { ClientSession } from "mongoose"

import type { AuthService } from "@endpoints/auth/services/auth.service"
import type { ItemRatingsRecalculationService } from "@endpoints/itemRatings/services/itemRatingsRecalculation.service"
import type { ItemRepository } from "@entities/item/services/item.repository"
import { EItemType } from "@entities/item/schemas/EItemType"
import type { ItemTagRepository } from "@entities/itemTag/services/itemTag.repository"
import { EUnit } from "@entities/shared/schemas/EUnit"
import type { UserRepository } from "@entities/user/services/user.repository"
import { EUserItemStatus } from "@entities/userItem/schemas/EUserItemStatus"
import { UserItemSchema } from "@entities/userItem/schemas/userItem.schema"
import type { UserItem } from "@entities/userItem/schemas/userItem.schema"
import type { UserItemRepository } from "@entities/userItem/services/userItem.repository"
import type { UserTasteProfileRecalculationService } from "@entities/userTasteProfile/services/userTasteProfileRecalculation.service"
import type { MongoTransactionService } from "@infrastructure/database/services/mongoTransaction.service"

import { UserItemService } from "../services/userItem.service"

describe("UserItemService: background events", () => {
  const userId = new Types.ObjectId()
  const itemId = new Types.ObjectId()
  const UserItemModel = model<UserItem>(
    "RatingEventUserItem",
    UserItemSchema.clone().set("timestamps", true),
  )
  const findOne = jest.fn<UserItemRepository["read"]["findOne"]>()
  const updateByFilter =
    jest.fn<UserItemRepository["write"]["updateByFilter"]>()
  const deleteByFilter =
    jest.fn<UserItemRepository["write"]["deleteByFilter"]>()
  const enqueueRating = jest.fn<ItemRatingsRecalculationService["enqueue"]>()
  const enqueueTaste =
    jest.fn<UserTasteProfileRecalculationService["enqueue"]>()
  const session = {} as ClientSession
  let isCommitted = false
  let entry = new UserItemModel()
  const run = jest.fn(
    async (callback: (session: ClientSession) => Promise<unknown>) => {
      const result = await callback(session)
      isCommitted = true

      return result
    },
  )
  const service = new UserItemService(
    {
      verifyAccessToken: async () => ({ sub: String(userId) }),
      getSession: async () => ({}),
    } as unknown as AuthService,
    {
      read: { findById: async () => ({ _id: userId }) },
    } as unknown as UserRepository,
    {
      read: { findOne: async () => ({ _id: itemId, type: EItemType.MOVIE }) },
    } as unknown as ItemRepository,
    {
      read: { findOne },
      write: { updateByFilter, deleteByFilter },
    } as unknown as UserItemRepository,
    { run } as unknown as MongoTransactionService,
    {} as ItemTagRepository,
    {
      enqueue: enqueueTaste,
    } as unknown as UserTasteProfileRecalculationService,
    { enqueue: enqueueRating } as unknown as ItemRatingsRecalculationService,
  )

  beforeEach(() => {
    jest.clearAllMocks()
    isCommitted = false
    entry = new UserItemModel({
      user: userId,
      item: itemId,
      status: EUserItemStatus.PLANNED,
      rating: 8,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    findOne.mockReset().mockImplementation(async () => entry)
    updateByFilter.mockReset().mockImplementation(async () => entry)
    deleteByFilter.mockReset().mockResolvedValue(entry)
    enqueueTaste.mockReset().mockResolvedValue("taste-job")
    enqueueRating.mockReset().mockResolvedValue("rating-job")
  })

  it.each([10, null])(
    "ставит пересчёт изменения оценки на %s только после commit",
    async (rating) => {
      enqueueRating.mockImplementation(async (id) => {
        expect(isCommitted).toBe(true)
        expect(entry.rating).toBe(rating)
        expect(id).toEqual(itemId)

        return "rating-job"
      })

      const response = await service.update("token", {
        id: entry._id,
        body: { rating },
      })

      expect(response.rating).toBe(rating)
      expect(enqueueRating).toHaveBeenCalledTimes(1)
      expect(enqueueTaste).toHaveBeenCalledWith(userId, itemId)
      expect(updateByFilter.mock.calls[0][2]).toEqual({ session })
    },
  )

  it("ставит пересчёт первой оценки", async () => {
    entry.rating = null

    await service.update("token", { id: entry._id, body: { rating: 1 } })

    expect(enqueueRating).toHaveBeenCalledTimes(1)
    expect(enqueueRating).toHaveBeenCalledWith(itemId)
  })

  it.each([
    { body: { rating: 8 }, tasteJobs: 0 },
    { body: { note: "Новая заметка" }, tasteJobs: 0 },
    { body: { isFavorite: true }, tasteJobs: 1 },
    { body: { status: EUserItemStatus.BLOCKED }, tasteJobs: 0 },
  ])(
    "не пересчитывает рейтинг при изменении %j без изменения оценки",
    async ({ body, tasteJobs }) => {
      await service.update("token", { id: entry._id, body })

      expect(enqueueRating).not.toHaveBeenCalled()
      expect(enqueueTaste).toHaveBeenCalledTimes(tasteJobs)
    },
  )

  it.each(["create", "update"])(
    "не пересчитывает рейтинг при операции %s над попыткой",
    async (operation) => {
      entry.status = EUserItemStatus.IN_PROGRESS
      entry.attempts.push({
        id: new Types.ObjectId(),
        isCompleted: false,
        progress: null,
        unit: EUnit.MINUTE,
        startedAt: null,
        completedAt: null,
      })

      if (operation === "create") {
        await service.createAttempt("token", {
          id: entry._id,
          body: { progress: 42 },
        })
      } else {
        await service.updateAttempt("token", {
          id: entry._id,
          attemptId: entry.attempts[0].id,
          body: { progress: 42 },
        })
      }

      expect(enqueueRating).not.toHaveBeenCalled()
      expect(enqueueTaste).not.toHaveBeenCalled()
    },
  )

  it.each([
    { previous: 0, operation: "create", isCompleted: true, tasteJobs: 1 },
    { previous: 2, operation: "create", isCompleted: true, tasteJobs: 1 },
    { previous: 3, operation: "create", isCompleted: true, tasteJobs: 0 },
    { previous: 1, operation: "update", isCompleted: false, tasteJobs: 1 },
    { previous: 3, operation: "update", isCompleted: false, tasteJobs: 1 },
    { previous: 4, operation: "update", isCompleted: false, tasteJobs: 0 },
    { previous: 1, operation: "update", isCompleted: true, tasteJobs: 0 },
  ])(
    "ставит $tasteJobs задач вкуса при $operation попытки с isCompleted=$isCompleted после $previous завершённых",
    async ({ previous, operation, isCompleted, tasteJobs }) => {
      entry.status = EUserItemStatus.IN_PROGRESS
      entry.attempts = Array.from(
        { length: Math.max(1, previous) },
        (_, index) => ({
          id: new Types.ObjectId(),
          isCompleted: index < previous,
          progress: null,
          unit: EUnit.MINUTE,
          startedAt: null,
          completedAt: null,
        }),
      )
      enqueueTaste.mockImplementation(async (user, item) => {
        expect(isCommitted).toBe(true)
        expect(user).toEqual(userId)
        expect(item).toEqual(itemId)

        return "taste-job"
      })

      if (operation === "create") {
        await service.createAttempt("token", {
          id: entry._id,
          body: { isCompleted },
        })
      } else {
        await service.updateAttempt("token", {
          id: entry._id,
          attemptId: entry.attempts[0].id,
          body: { isCompleted },
        })
      }

      expect(enqueueTaste).toHaveBeenCalledTimes(tasteJobs)
      expect(enqueueRating).not.toHaveBeenCalled()
    },
  )

  it("пересчитывает теги при завершении первой попытки через смену статуса", async () => {
    entry.rating = null

    await service.update("token", {
      id: entry._id,
      body: { status: EUserItemStatus.COMPLETED, note: "Готово" },
    })

    expect(entry.attempts[0].isCompleted).toBe(true)
    expect(enqueueTaste).toHaveBeenCalledWith(userId, itemId)
    expect(enqueueRating).not.toHaveBeenCalled()
  })

  it.each([null, "Только заметка"])(
    "не ставит задачи для заметки %s вместе с неизменными оценкой и избранным",
    async (note) => {
      await service.update("token", {
        id: entry._id,
        body: { note, rating: 8, isFavorite: false },
      })

      expect(entry.note).toBe(note)
      expect(enqueueTaste).not.toHaveBeenCalled()
      expect(enqueueRating).not.toHaveBeenCalled()
    },
  )

  it.each([8, null])(
    "пересчитывает удалённую запись с оценкой %s только при наличии оценки",
    async (rating) => {
      entry.rating = rating
      enqueueRating.mockImplementation(async () => {
        expect(deleteByFilter).toHaveBeenCalledWith({
          _id: entry._id,
          user: userId,
        })

        return "rating-job"
      })

      await service.remove("token", entry._id)

      expect(enqueueRating).toHaveBeenCalledTimes(rating === null ? 0 : 1)
      expect(enqueueTaste).toHaveBeenCalledTimes(1)
    },
  )

  it("не ставит задачи при удалении отсутствующей записи", async () => {
    deleteByFilter.mockResolvedValue(null)

    await expect(service.remove("token", entry._id)).rejects.toBeInstanceOf(
      NotFoundException,
    )
    expect(enqueueRating).not.toHaveBeenCalled()
    expect(enqueueTaste).not.toHaveBeenCalled()
  })

  it("не ставит задачи после отклонённого изменения оценки", async () => {
    await expect(
      service.update("token", {
        id: entry._id,
        body: { status: EUserItemStatus.SKIPPED, rating: 10 },
      }),
    ).rejects.toBeInstanceOf(ConflictException)

    expect(isCommitted).toBe(false)
    expect(updateByFilter).not.toHaveBeenCalled()
    expect(enqueueRating).not.toHaveBeenCalled()
    expect(enqueueTaste).not.toHaveBeenCalled()
  })

  it("не ставит задачи, если запись в транзакции завершилась ошибкой", async () => {
    const error = new Error("Transaction write failure")
    updateByFilter.mockRejectedValueOnce(error)

    await expect(
      service.update("token", {
        id: entry._id,
        body: { rating: 10 },
      }),
    ).rejects.toBe(error)

    expect(isCommitted).toBe(false)
    expect(enqueueRating).not.toHaveBeenCalled()
    expect(enqueueTaste).not.toHaveBeenCalled()
  })

  it("не ставит задачи, если commit завершился ошибкой после успешной записи", async () => {
    const error = new Error("Commit failure")
    run.mockImplementationOnce(async (callback) => {
      await callback(session)

      throw error
    })

    await expect(
      service.update("token", {
        id: entry._id,
        body: { rating: 10 },
      }),
    ).rejects.toBe(error)

    expect(updateByFilter).toHaveBeenCalledTimes(1)
    expect(isCommitted).toBe(false)
    expect(enqueueRating).not.toHaveBeenCalled()
    expect(enqueueTaste).not.toHaveBeenCalled()
  })

  it.each(["rating", "taste"])(
    "передаёт ошибку очереди %s после commit и пытается поставить обе задачи",
    async (queue) => {
      const error = new Error("Queue unavailable")
      const enqueue = queue === "rating" ? enqueueRating : enqueueTaste
      enqueue.mockRejectedValueOnce(error)

      await expect(
        service.update("token", {
          id: entry._id,
          body: { rating: 10 },
        }),
      ).rejects.toBe(error)

      expect(isCommitted).toBe(true)
      expect(entry.rating).toBe(10)
      expect(enqueueRating).toHaveBeenCalledWith(itemId)
      expect(enqueueTaste).toHaveBeenCalledWith(userId, itemId)
    },
  )
})
