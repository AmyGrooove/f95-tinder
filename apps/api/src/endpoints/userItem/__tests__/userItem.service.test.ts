import { beforeEach, describe, expect, it, jest } from "@jest/globals"
import { ConflictException, NotFoundException } from "@nestjs/common"
import { model, mongo, Types } from "mongoose"
import type { ClientSession } from "mongoose"

import type { AuthService } from "@endpoints/auth/services/auth.service"
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
import { UserItemMetricsService } from "../services/userItemMetrics.service"

describe("UserItemService", () => {
  const userId = new Types.ObjectId()
  const itemId = new Types.ObjectId()
  const UserItemModel = model<UserItem>(
    "MetricMutationUserItem",
    UserItemSchema.clone().set("timestamps", true),
  )
  const findOne = jest.fn<UserItemRepository["read"]["findOne"]>()
  const updateByFilter =
    jest.fn<UserItemRepository["write"]["updateByFilter"]>()
  const deleteByFilter =
    jest.fn<UserItemRepository["write"]["deleteByFilter"]>()
  const create = jest.fn<UserItemRepository["write"]["create"]>()
  const updateMetrics = jest.fn<UserItemMetricsService["update"]>()
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
      read: {
        checkIsExists: async () => true,
        findOne: async () => ({ _id: itemId, type: EItemType.MOVIE }),
      },
    } as unknown as ItemRepository,
    {
      read: { findOne },
      write: { create, updateByFilter, deleteByFilter },
    } as unknown as UserItemRepository,
    { run } as unknown as MongoTransactionService,
    {} as ItemTagRepository,
    {
      enqueue: enqueueTaste,
    } as unknown as UserTasteProfileRecalculationService,
    {
      update: updateMetrics,
      getState: UserItemMetricsService.prototype.getState,
    } as unknown as UserItemMetricsService,
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
    create.mockReset().mockImplementation(
      async (payload) =>
        new UserItemModel({
          ...payload,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
    )
    updateByFilter.mockReset().mockImplementation(async () => entry)
    deleteByFilter.mockReset().mockResolvedValue(entry)
    enqueueTaste.mockReset().mockResolvedValue("taste-job")
    updateMetrics.mockReset().mockResolvedValue(undefined)
  })

  it.each([10, null])(
    "обновляет оценку на %s и метрики до commit, а вкус после commit",
    async (rating) => {
      updateMetrics.mockImplementation(async (props) => {
        expect(isCommitted).toBe(false)
        expect(props).toMatchObject({
          itemId,
          previous: { rating: 8 },
          next: { rating },
          session,
        })
      })
      enqueueTaste.mockImplementation(async () => {
        expect(isCommitted).toBe(true)
        return "queued"
      })
      const response = await service.update("token", {
        id: entry._id,
        body: { rating },
      })
      expect(response.rating).toBe(rating)
      expect(updateMetrics).toHaveBeenCalledTimes(1)
      expect(enqueueTaste).toHaveBeenCalledWith(userId, itemId)
      expect(updateByFilter.mock.calls[0][2]).toEqual({ session })
    },
  )

  it.each(["create", "skip", "block"] as const)(
    "сохраняет %s и метрики в одной транзакции",
    async (operation) => {
      await service[operation]("token", {
        itemId: String(itemId),
        status: EUserItemStatus.PLANNED,
      })
      expect(create.mock.calls[0][1]).toEqual({ session })
      expect(deleteByFilter.mock.calls[0][1]).toEqual({ session })
      expect(updateMetrics).toHaveBeenCalledWith(
        expect.objectContaining({
          itemId,
          previous: null,
          next: expect.objectContaining({ rating: null }),
          session,
        }),
      )
      expect(run).toHaveBeenCalledTimes(1)
      expect(enqueueTaste).toHaveBeenCalledTimes(1)
    },
  )

  it.each([true, false])(
    "сохраняет новое избранное %s и передаёт независимые состояния",
    async (isFavorite) => {
      entry.isFavorite = !isFavorite
      await service.update("token", { id: entry._id, body: { isFavorite } })
      expect(updateMetrics).toHaveBeenCalledWith(
        expect.objectContaining({
          previous: expect.objectContaining({ isFavorite: !isFavorite }),
          next: expect.objectContaining({ isFavorite }),
        }),
      )
      expect(enqueueTaste).toHaveBeenCalledTimes(1)
    },
  )

  it.each([
    { note: "Заметка" },
    { rating: 8 },
    { isFavorite: false },
    { status: EUserItemStatus.BLOCKED },
  ])(
    "не ставит taste-задачу без изменения вкусовых сигналов %j",
    async (body) => {
      await service.update("token", { id: entry._id, body })
      expect(updateMetrics).toHaveBeenCalledTimes(1)
      expect(enqueueTaste).not.toHaveBeenCalled()
    },
  )

  it.each(["create", "update"] as const)(
    "передаёт все завершённые попытки при %s без изменения вкуса",
    async (operation) => {
      entry.status = EUserItemStatus.IN_PROGRESS
      entry.attempts = Array.from({ length: 4 }, () => ({
        id: new Types.ObjectId(),
        isCompleted: true,
        progress: null,
        unit: EUnit.MINUTE,
        startedAt: null,
        completedAt: null,
      }))
      if (operation === "create") {
        await service.createAttempt("token", {
          id: entry._id,
          body: { isCompleted: true },
        })
      } else {
        await service.updateAttempt("token", {
          id: entry._id,
          attemptId: entry.attempts[0].id,
          body: { isCompleted: false },
        })
      }
      expect(updateMetrics).toHaveBeenCalledWith(
        expect.objectContaining({
          previous: expect.objectContaining({ completedAttemptsCount: 4 }),
          next: expect.objectContaining({
            completedAttemptsCount: operation === "create" ? 5 : 3,
          }),
        }),
      )
      expect(enqueueTaste).not.toHaveBeenCalled()
    },
  )

  it("учитывает первую завершённую попытку через смену статуса без taste-задачи", async () => {
    entry.rating = null
    await service.update("token", {
      id: entry._id,
      body: { status: EUserItemStatus.COMPLETED },
    })
    expect(updateMetrics).toHaveBeenCalledWith(
      expect.objectContaining({
        next: expect.objectContaining({
          status: EUserItemStatus.COMPLETED,
          completedAttemptsCount: 1,
        }),
      }),
    )
    expect(enqueueTaste).not.toHaveBeenCalled()
  })

  it("удаляет запись и вычитает её вклад в той же session", async () => {
    await service.remove("token", entry._id)
    expect(deleteByFilter).toHaveBeenCalledWith(
      { _id: entry._id, user: userId },
      { session },
    )
    expect(updateMetrics).toHaveBeenCalledWith(
      expect.objectContaining({
        itemId,
        previous: expect.objectContaining({ rating: 8 }),
        next: null,
        session,
      }),
    )
    expect(enqueueTaste).toHaveBeenCalledTimes(1)
  })

  it("не обновляет метрики при удалении отсутствующей записи", async () => {
    deleteByFilter.mockResolvedValue(null)
    await expect(service.remove("token", entry._id)).rejects.toBeInstanceOf(
      NotFoundException,
    )
    expect(updateMetrics).not.toHaveBeenCalled()
    expect(enqueueTaste).not.toHaveBeenCalled()
  })

  it("не записывает метрики при недопустимом переходе в skipped", async () => {
    await expect(
      service.update("token", {
        id: entry._id,
        body: { status: EUserItemStatus.SKIPPED, rating: 10 },
      }),
    ).rejects.toBeInstanceOf(ConflictException)
    expect(updateByFilter).not.toHaveBeenCalled()
    expect(updateMetrics).not.toHaveBeenCalled()
    expect(isCommitted).toBe(false)
  })

  it.each(["userItem", "metrics", "commit"])(
    "передаёт ошибку %s без taste-задачи",
    async (stage) => {
      const error = new Error("Транзакция не сохранена")
      if (stage === "userItem") {
        updateByFilter.mockRejectedValueOnce(error)
      } else if (stage === "metrics") {
        updateMetrics.mockRejectedValueOnce(error)
      } else {
        run.mockImplementationOnce(async (callback) => {
          await callback(session)
          throw error
        })
      }
      await expect(
        service.update("token", { id: entry._id, body: { rating: 10 } }),
      ).rejects.toBe(error)
      expect(isCommitted).toBe(false)
      expect(enqueueTaste).not.toHaveBeenCalled()
    },
  )

  it.each([{ item: 1 }, { key: 1 }])(
    "повторяет транзакцию при конфликте первого создания метрики %j",
    async (keyPattern) => {
      run.mockRejectedValueOnce(
        new mongo.MongoServerError({ code: 11000, keyPattern }),
      )
      await service.update("token", { id: entry._id, body: { rating: 9 } })
      expect(run).toHaveBeenCalledTimes(2)
      expect(enqueueTaste).toHaveBeenCalledTimes(1)
    },
  )

  it("ограничивает повторы конфликта метрик тремя транзакциями", async () => {
    const error = new mongo.MongoServerError({
      code: 11000,
      keyPattern: { key: 1 },
    })
    run
      .mockRejectedValueOnce(error)
      .mockRejectedValueOnce(error)
      .mockRejectedValueOnce(error)
    await expect(
      service.update("token", { id: entry._id, body: { rating: 9 } }),
    ).rejects.toBe(error)
    expect(run).toHaveBeenCalledTimes(3)
    expect(enqueueTaste).not.toHaveBeenCalled()
  })

  it("не повторяет конфликт уникальности UserItem и возвращает 409", async () => {
    create.mockRejectedValueOnce(
      new mongo.MongoServerError({
        code: 11000,
        keyPattern: { user: 1, item: 1 },
      }),
    )
    await expect(
      service.create("token", {
        itemId: String(itemId),
        status: EUserItemStatus.PLANNED,
      }),
    ).rejects.toBeInstanceOf(ConflictException)
    expect(run).toHaveBeenCalledTimes(1)
    expect(updateMetrics).not.toHaveBeenCalled()
  })

  it("сохраняет метрики до ошибки очереди вкуса после commit", async () => {
    const error = new Error("Очередь недоступна")
    enqueueTaste.mockRejectedValueOnce(error)
    await expect(
      service.update("token", { id: entry._id, body: { rating: 10 } }),
    ).rejects.toBe(error)
    expect(isCommitted).toBe(true)
    expect(updateMetrics).toHaveBeenCalledTimes(1)
  })
})
