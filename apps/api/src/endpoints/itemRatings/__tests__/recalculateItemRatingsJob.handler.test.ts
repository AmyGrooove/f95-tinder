import { beforeEach, describe, expect, it, jest } from "@jest/globals"
import { Types } from "mongoose"

import type { ItemRepository } from "@entities/item/services/item.repository"
import type { ItemMetricRepository } from "@entities/itemMetric/services/itemMetric.repository"
import type { UserItemRepository } from "@entities/userItem/services/userItem.repository"
import { JobCancelledError } from "@infrastructure/jobs/errors/JobCancelledError"
import type { IJobContext } from "@infrastructure/jobs/types/IJobContext"

import { RecalculateItemRatingsJobHandler } from "../handlers/recalculateItemRatingsJob.handler"

describe("RecalculateItemRatingsJobHandler", () => {
  const itemId = new Types.ObjectId()
  const checkIsExists = jest.fn<ItemRepository["read"]["checkIsExists"]>()
  const getRatingSummaries = jest.fn<UserItemRepository["getRatingSummaries"]>()
  const updateByFilter =
    jest.fn<ItemMetricRepository["write"]["updateByFilter"]>()
  const context = {
    id: "item-ratings",
    attempt: 1,
    throwIfCancelled: jest.fn<IJobContext["throwIfCancelled"]>(),
    updateProgress: jest.fn<IJobContext["updateProgress"]>(),
  } satisfies IJobContext
  const handler = new RecalculateItemRatingsJobHandler(
    { read: { checkIsExists } } as unknown as ItemRepository,
    { write: { updateByFilter } } as unknown as ItemMetricRepository,
    { getRatingSummaries } as unknown as UserItemRepository,
  )

  beforeEach(() => {
    jest.resetAllMocks()
    checkIsExists.mockResolvedValue(true)
    getRatingSummaries.mockResolvedValue([])
    updateByFilter.mockResolvedValue(null)
    context.throwIfCancelled.mockResolvedValue(undefined)
  })

  it("не агрегирует оценки и не создаёт метрику отсутствующего Item", async () => {
    checkIsExists.mockResolvedValue(false)

    await expect(handler.handle(String(itemId), context)).resolves.toEqual({
      processedItems: 0,
    })
    expect(checkIsExists).toHaveBeenCalledWith({ _id: itemId })
    expect(getRatingSummaries).not.toHaveBeenCalled()
    expect(updateByFilter).not.toHaveBeenCalled()
  })

  it("пересчитывает только переданный Item и записывает все поля метрик", async () => {
    getRatingSummaries.mockResolvedValueOnce([
      {
        _id: itemId,
        ratingAverage: 19 / 3,
        ratingsCount: 3,
        completedAttemptsCount: 5,
        favoritesCount: 2,
        ratingDistribution: {
          one: 1,
          two: 0,
          three: 0,
          four: 0,
          five: 0,
          six: 0,
          seven: 0,
          eight: 1,
          nine: 0,
          ten: 1,
        },
        statusCounts: {
          planned: 1,
          inProgress: 2,
          onHold: 3,
          completed: 4,
          dropped: 5,
        },
      },
    ])

    await expect(handler.handle(String(itemId), context)).resolves.toEqual({
      processedItems: 1,
    })
    expect(checkIsExists).toHaveBeenCalledTimes(1)
    expect(checkIsExists).toHaveBeenCalledWith({ _id: itemId })
    expect(getRatingSummaries).toHaveBeenCalledTimes(1)
    expect(getRatingSummaries).toHaveBeenCalledWith([itemId])
    expect(updateByFilter).toHaveBeenCalledTimes(1)
    expect(updateByFilter).toHaveBeenCalledWith(
      { item: itemId },
      {
        $set: {
          ratingAverage: 19 / 3,
          ratingsCount: 3,
          completedAttemptsCount: 5,
          favoritesCount: 2,
          ratingDistribution: {
            one: 1,
            two: 0,
            three: 0,
            four: 0,
            five: 0,
            six: 0,
            seven: 0,
            eight: 1,
            nine: 0,
            ten: 1,
          },
          statusCounts: {
            planned: 1,
            inProgress: 2,
            onHold: 3,
            completed: 4,
            dropped: 5,
          },
        },
      },
      { upsert: true },
    )
  })

  it("сбрасывает среднюю в null и все счётчики в 0, если записей больше нет", async () => {
    await handler.handle(String(itemId), context)

    expect(updateByFilter).toHaveBeenCalledWith(
      { item: itemId },
      {
        $set: {
          ratingAverage: null,
          ratingsCount: 0,
          completedAttemptsCount: 0,
          favoritesCount: 0,
          ratingDistribution: {
            one: 0,
            two: 0,
            three: 0,
            four: 0,
            five: 0,
            six: 0,
            seven: 0,
            eight: 0,
            nine: 0,
            ten: 0,
          },
          statusCounts: {
            planned: 0,
            inProgress: 0,
            onHold: 0,
            completed: 0,
            dropped: 0,
          },
        },
      },
      { upsert: true },
    )
  })

  it.each(["read", "aggregate", "write"])(
    "пробрасывает ошибку на этапе %s и не выполняет последующие операции",
    async (stage) => {
      const error = new Error(stage)

      if (stage === "read") {
        checkIsExists.mockRejectedValueOnce(error)
      } else if (stage === "aggregate") {
        getRatingSummaries.mockRejectedValueOnce(error)
      } else {
        updateByFilter.mockRejectedValueOnce(error)
      }

      await expect(handler.handle(String(itemId), context)).rejects.toBe(error)
      expect(checkIsExists).toHaveBeenCalledTimes(1)
      expect(getRatingSummaries).toHaveBeenCalledTimes(stage === "read" ? 0 : 1)
      expect(updateByFilter).toHaveBeenCalledTimes(stage === "write" ? 1 : 0)
    },
  )

  it.each([1, 2])(
    "останавливает отменённую задачу на проверке %i до записи",
    async (check) => {
      const error = new JobCancelledError()

      if (check === 2) {
        context.throwIfCancelled.mockResolvedValueOnce(undefined)
      }

      context.throwIfCancelled.mockRejectedValueOnce(error)

      await expect(handler.handle(String(itemId), context)).rejects.toBe(error)
      expect(checkIsExists).toHaveBeenCalledTimes(check === 1 ? 0 : 1)
      expect(updateByFilter).not.toHaveBeenCalled()
    },
  )
})
