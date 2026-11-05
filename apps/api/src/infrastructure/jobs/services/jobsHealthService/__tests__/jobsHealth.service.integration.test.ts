import { describe, expect, it } from "@jest/globals"

import { createJobsTestContext } from "../../../__tests__/setup/createJobsTestContext"

describe("JobsHealthService Redis", () => {
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
