import { beforeEach, describe, expect, it, jest } from "@jest/globals"
import { Types } from "mongoose"

import type { JobService } from "@infrastructure/jobs/services/job.service"

import { ItemRatingsRecalculationService } from "../services/itemRatingsRecalculation.service"

describe("ItemRatingsRecalculationService", () => {
  const add = jest.fn<JobService["add"]>()
  const service = new ItemRatingsRecalculationService({
    add,
  } as unknown as JobService)

  beforeEach(() => {
    add.mockReset().mockResolvedValue("rating-job")
  })

  it("передаёт Item ID, повторы и объединение событий с повторным запуском после активной задачи", async () => {
    const itemId = new Types.ObjectId()

    await expect(service.enqueue(itemId)).resolves.toBe("rating-job")
    expect(add).toHaveBeenCalledTimes(1)
    expect(add).toHaveBeenCalledWith(
      {
        name: "item.recalculateRatings",
        version: 2,
        retryDelays: [5000, 30000, 120000],
      },
      itemId.toHexString(),
      {
        deduplication: {
          id: `item.recalculateRatings:${itemId}`,
          keepLastIfActive: true,
        },
      },
    )
  })

  it("использует разные ключи объединения для разных Item", async () => {
    await service.enqueue(new Types.ObjectId())
    await service.enqueue(new Types.ObjectId())

    expect(add.mock.calls[0][2]?.deduplication?.id).not.toBe(
      add.mock.calls[1][2]?.deduplication?.id,
    )
  })

  it("передаёт ошибку постановки в очередь вызывающему коду", async () => {
    const error = new Error("Redis unavailable")
    add.mockRejectedValue(error)

    await expect(service.enqueue(new Types.ObjectId())).rejects.toBe(error)
  })
})
