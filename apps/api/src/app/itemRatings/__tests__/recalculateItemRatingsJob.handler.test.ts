import { beforeEach, describe, expect, it, jest } from "@jest/globals"
import { Types } from "mongoose"

import type { ItemRepository } from "@entities/item/services/item.repository"
import type { ItemMetricRepository } from "@entities/itemMetric/services/itemMetric.repository"
import type { UserItemRepository } from "@entities/userItem/services/userItem.repository"
import { JobCancelledError } from "@infrastructure/jobs/errors/JobCancelledError"
import type { IJobContext } from "@infrastructure/jobs/types/IJobContext"

import { RecalculateItemRatingsJobHandler } from "../handlers/recalculateItemRatingsJob.handler"

describe("RecalculateItemRatingsJobHandler", () => {
  const findMany =
    jest.fn<
      (
        ...args: Parameters<ItemRepository["read"]["findMany"]>
      ) => Promise<{ _id: Types.ObjectId }[]>
    >()
  const getRatingSummaries = jest.fn<UserItemRepository["getRatingSummaries"]>()
  const bulkWrite =
    jest.fn<
      (
        ...args: Parameters<ItemMetricRepository["bulk"]["bulkWrite"]>
      ) => Promise<unknown>
    >()
  const context = {
    id: "item-ratings",
    attempt: 1,
    throwIfCancelled: jest.fn<IJobContext["throwIfCancelled"]>(),
    updateProgress: jest.fn<IJobContext["updateProgress"]>(),
  } satisfies IJobContext
  const handler = new RecalculateItemRatingsJobHandler(
    { read: { findMany } } as unknown as ItemRepository,
    { bulk: { bulkWrite } } as unknown as ItemMetricRepository,
    { getRatingSummaries } as unknown as UserItemRepository,
  )

  beforeEach(() => {
    jest.resetAllMocks()
    findMany.mockResolvedValue([])
    getRatingSummaries.mockResolvedValue([])
    bulkWrite.mockResolvedValue(undefined)
    context.throwIfCancelled.mockResolvedValue(undefined)
  })

  it("завершает пустой каталог без агрегации и записи метрик", async () => {
    await expect(handler.handle(null, context)).resolves.toEqual({
      processedItems: 0,
    })
    expect(findMany).toHaveBeenCalledTimes(1)
    expect(getRatingSummaries).not.toHaveBeenCalled()
    expect(bulkWrite).not.toHaveBeenCalled()
  })

  it("сопоставляет оценки по значению ObjectId и обновляет только поля рейтинга", async () => {
    const ratedId = new Types.ObjectId()
    const unratedId = new Types.ObjectId()
    findMany.mockResolvedValueOnce([{ _id: ratedId }, { _id: unratedId }])
    getRatingSummaries.mockResolvedValueOnce([
      {
        _id: new Types.ObjectId(String(ratedId)),
        ratingAverage: 19 / 3,
        ratingsCount: 3,
      },
    ])

    await expect(handler.handle(null, context)).resolves.toEqual({
      processedItems: 2,
    })
    expect(getRatingSummaries).toHaveBeenCalledWith([ratedId, unratedId])
    expect(bulkWrite).toHaveBeenCalledTimes(1)
    expect(bulkWrite).toHaveBeenCalledWith(
      [
        {
          updateOne: {
            filter: { item: ratedId },
            update: {
              $set: { ratingAverage: 19 / 3, ratingsCount: 3 },
            },
            upsert: true,
          },
        },
        {
          updateOne: {
            filter: { item: unratedId },
            update: { $set: { ratingAverage: null, ratingsCount: 0 } },
            upsert: true,
          },
        },
      ],
      { ordered: false },
    )
  })

  it("обрабатывает несколько порций по 500 объектов без повторной обработки границы", async () => {
    const items = Array.from({ length: 501 }, () => ({
      _id: new Types.ObjectId(),
    }))
    findMany
      .mockResolvedValueOnce(items.slice(0, 500))
      .mockResolvedValueOnce(items.slice(500))

    await expect(handler.handle(null, context)).resolves.toEqual({
      processedItems: 501,
    })
    expect(findMany.mock.calls).toEqual([
      [{}, { _id: 1 }, { sort: { _id: 1 }, limit: 500 }],
      [
        { _id: { $gt: items[499]._id } },
        { _id: 1 },
        { sort: { _id: 1 }, limit: 500 },
      ],
      [
        { _id: { $gt: items[500]._id } },
        { _id: 1 },
        { sort: { _id: 1 }, limit: 500 },
      ],
    ])
    expect(getRatingSummaries.mock.calls).toEqual([
      [items.slice(0, 500).map((item) => item._id)],
      [[items[500]._id]],
    ])
    expect(
      bulkWrite.mock.calls.map(([operations]) => operations.length),
    ).toEqual([500, 1])
  })

  it.each(["read", "aggregate", "write"])(
    "пробрасывает ошибку на этапе %s без перехода к следующей порции",
    async (stage) => {
      const error = new Error(stage)
      findMany.mockResolvedValueOnce([{ _id: new Types.ObjectId() }])

      if (stage === "read") {
        findMany.mockReset().mockRejectedValueOnce(error)
      } else if (stage === "aggregate") {
        getRatingSummaries.mockRejectedValueOnce(error)
      } else {
        bulkWrite.mockRejectedValueOnce(error)
      }

      await expect(handler.handle(null, context)).rejects.toBe(error)
      expect(findMany).toHaveBeenCalledTimes(1)
      expect(getRatingSummaries).toHaveBeenCalledTimes(stage === "read" ? 0 : 1)
      expect(bulkWrite).toHaveBeenCalledTimes(stage === "write" ? 1 : 0)
    },
  )

  it.each([1, 2])(
    "останавливает отменённую задачу на проверке %i до записи",
    async (check) => {
      findMany.mockResolvedValueOnce([{ _id: new Types.ObjectId() }])
      const error = new JobCancelledError()

      if (check === 2) {
        context.throwIfCancelled.mockResolvedValueOnce(undefined)
      }

      context.throwIfCancelled.mockRejectedValueOnce(error)

      await expect(handler.handle(null, context)).rejects.toBe(error)
      expect(findMany).toHaveBeenCalledTimes(check === 1 ? 0 : 1)
      expect(bulkWrite).not.toHaveBeenCalled()
    },
  )

  it("сохраняет записанную порцию при отмене перед следующей", async () => {
    findMany.mockResolvedValueOnce([{ _id: new Types.ObjectId() }])
    context.throwIfCancelled
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new JobCancelledError())

    await expect(handler.handle(null, context)).rejects.toBeInstanceOf(
      JobCancelledError,
    )
    expect(findMany).toHaveBeenCalledTimes(1)
    expect(bulkWrite).toHaveBeenCalledTimes(1)
  })
})
