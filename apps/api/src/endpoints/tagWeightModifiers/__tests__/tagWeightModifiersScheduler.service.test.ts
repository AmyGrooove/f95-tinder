import { beforeEach, describe, expect, it, jest } from "@jest/globals"

import type { JobService } from "@infrastructure/jobs/services/job.service"

import { TagWeightModifiersSchedulerService } from "../services/tagWeightModifiersScheduler.service"
import { RECALCULATE_TAG_WEIGHT_MODIFIERS_JOB } from "../static/RECALCULATE_TAG_WEIGHT_MODIFIERS_JOB"

describe("TagWeightModifiersSchedulerService", () => {
  const add = jest.fn<JobService["add"]>()
  const scheduler = new TagWeightModifiersSchedulerService({
    add,
  } as unknown as JobService)

  beforeEach(() => {
    add.mockReset()
  })

  it("ставит задачу версии 1 с null payload, интервалами повторов и дедупликацией без TTL", async () => {
    add.mockResolvedValue("job-id")

    await expect(scheduler.enqueueRecalculation()).resolves.toBe("job-id")
    expect(add).toHaveBeenCalledTimes(1)
    expect(add).toHaveBeenCalledWith(
      {
        name: "tag.recalculateWeightModifiers",
        version: 1,
        retryDelays: [5000, 30000, 120000],
      },
      null,
      { deduplication: { id: RECALCULATE_TAG_WEIGHT_MODIFIERS_JOB.name } },
    )
  })

  it("запланирован ежедневно на 03:00 Москвы с ожиданием завершения вызова", () => {
    expect(
      Reflect.getMetadata(
        "SCHEDULE_CRON_OPTIONS",
        scheduler.enqueueRecalculation,
      ),
    ).toEqual({
      cronTime: "0 0 3 * * *",
      timeZone: "Europe/Moscow",
      waitForCompletion: true,
    })
  })

  it("передаёт ошибку очереди вызывающему коду", async () => {
    const error = new Error("Redis unavailable")
    add.mockRejectedValue(error)

    await expect(scheduler.enqueueRecalculation()).rejects.toBe(error)
  })
})
