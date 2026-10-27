import { beforeEach, describe, expect, it, jest } from "@jest/globals"

import type { JobService } from "@infrastructure/jobs/services/job.service"

import { ItemRatingsSchedulerService } from "../services/itemRatingsScheduler.service"

describe("ItemRatingsSchedulerService", () => {
  const add = jest.fn<JobService["add"]>()
  const scheduler = new ItemRatingsSchedulerService({
    add,
  } as unknown as JobService)

  beforeEach(() => {
    add.mockReset()
  })

  it("ставит задачу с повторами и дедупликацией без TTL и возвращает её идентификатор", async () => {
    add.mockResolvedValue("rating-job")

    await expect(scheduler.enqueueRecalculation()).resolves.toBe("rating-job")
    expect(add).toHaveBeenCalledTimes(1)
    expect(add).toHaveBeenCalledWith(
      {
        name: "item.recalculateRatings",
        version: 1,
        retryDelays: [5000, 30000, 120000],
      },
      null,
      { deduplication: { id: "item.recalculateRatings" } },
    )
  })

  it("запланирован на 00, 05, 10, 15 и 20 часов Москвы с ожиданием завершения вызова", () => {
    expect(
      Reflect.getMetadata(
        "SCHEDULE_CRON_OPTIONS",
        scheduler.enqueueRecalculation,
      ),
    ).toEqual({
      cronTime: "0 0 */5 * * *",
      timeZone: "Europe/Moscow",
      waitForCompletion: true,
    })
  })

  it("передаёт ошибку постановки в очередь вызывающему коду", async () => {
    const error = new Error("Redis unavailable")
    add.mockRejectedValue(error)

    await expect(scheduler.enqueueRecalculation()).rejects.toBe(error)
  })
})
