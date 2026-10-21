import { describe, expect, it, jest } from "@jest/globals"
import type { Queue } from "bullmq"

import { JobsHealthService } from "../services/jobsHealth.service"

describe("JobsHealthService", () => {
  it("возвращает true после успешного чтения счётчиков очереди", async () => {
    const getJobCounts = jest.fn<Queue["getJobCounts"]>().mockResolvedValue({})
    const service = new JobsHealthService({ getJobCounts } as unknown as Queue)

    await expect(service.checkHealth()).resolves.toBe(true)
    expect(getJobCounts).toHaveBeenCalledTimes(1)
  })

  it("передаёт ошибку недоступной очереди вызывающему коду", async () => {
    const error = new Error("Redis unavailable")
    const getJobCounts = jest
      .fn<Queue["getJobCounts"]>()
      .mockRejectedValue(error)
    const service = new JobsHealthService({ getJobCounts } as unknown as Queue)

    await expect(service.checkHealth()).rejects.toBe(error)
  })
})
