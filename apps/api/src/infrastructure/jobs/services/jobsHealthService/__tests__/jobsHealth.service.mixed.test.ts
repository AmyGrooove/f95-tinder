import { describe, expect, it, jest } from "@jest/globals"
import type { Queue } from "bullmq"
import { JobsHealthService } from "../core/jobsHealth.service"

if (Reflect.get(globalThis, "IS_INTEGRATION_TEST") === true) {
  const { createJobsTestContext } =
    await import("../../../__tests__/setup/createJobsTestContext")

  describe("JobsHealthService", () => {
    const jobsContext = createJobsTestContext()

    describe("JobsHealthService", () => {
      it("проверяет пустую и заполненную очередь без изменения задач", async () => {
        await expect(jobsContext.health.checkHealth()).resolves.toBe(true)
        const id = await jobsContext.service.add(
          jobsContext.definition,
          { value: 1 },
          { delay: 60_000 },
        )
        await expect(jobsContext.health.checkHealth()).resolves.toBe(true)
        expect(await jobsContext.queue.getJobCounts("delayed")).toEqual({
          delayed: 1,
        })
        expect((await jobsContext.queue.getJob(id))?.data.payload).toEqual({
          value: 1,
        })
      })
    })
  })
} else {
  describe("JobsHealthService", () => {
    it("возвращает true после успешного чтения счётчиков очереди", async () => {
      const getJobCounts = jest
        .fn<Queue["getJobCounts"]>()
        .mockResolvedValue({})
      const service = new JobsHealthService({
        getJobCounts,
      } as unknown as Queue)

      await expect(service.checkHealth()).resolves.toBe(true)
      expect(getJobCounts).toHaveBeenCalledTimes(1)
    })

    it("передаёт ошибку недоступной очереди вызывающему коду", async () => {
      const error = new Error("Redis unavailable")
      const getJobCounts = jest
        .fn<Queue["getJobCounts"]>()
        .mockRejectedValue(error)
      const service = new JobsHealthService({
        getJobCounts,
      } as unknown as Queue)

      await expect(service.checkHealth()).rejects.toBe(error)
    })
  })
}
