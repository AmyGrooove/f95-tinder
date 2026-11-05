import { setTimeout } from "node:timers/promises"
import { describe, expect, it } from "@jest/globals"

import { NonRetryableJobError } from "../../../errors/NonRetryableJobError"
import { defineJob } from "../../../functions/defineJob"
import { JOB_CANCELLED_RESULT } from "../../../static/JOB_CANCELLED_RESULT"

import { createJobsTestContext } from "../../../__tests__/setup/createJobsTestContext"

describe("JobService Redis", () => {
  const jobsContext = createJobsTestContext()

  describe("JobService", () => {
    it("сохраняет конверт и обновляет отложенную задачу в Redis", async () => {
      const id = await jobsContext.service.add(
        jobsContext.definition,
        { value: 1 },
        { jobId: "custom-id", delay: 60_000 },
      )
      expect(id).toBe("custom-id")
      expect((await jobsContext.queue.getJob(id))?.data).toEqual({
        name: jobsContext.definition.name,
        version: 1,
        retryDelays: [100, 150],
        payload: { value: 1 },
        cancellationState: "none",
      })
      await jobsContext.service.update(jobsContext.definition, id, { value: 2 })
      expect((await jobsContext.queue.getJob(id))?.data.payload).toEqual({
        value: 2,
      })
      await expect(jobsContext.service.get(id)).resolves.toEqual(
        expect.objectContaining({ id, state: "queued", attempt: 0 }),
      )
      await expect(jobsContext.service.get("missing")).resolves.toBeNull()
    })

    it("дедуплицирует отложенные задачи по заданному ключу", async () => {
      const options = { delay: 60_000, deduplication: { id: "unique" } }
      const id = await jobsContext.service.add(
        jobsContext.definition,
        { value: 1 },
        options,
      )
      await expect(
        jobsContext.service.add(jobsContext.definition, { value: 2 }, options),
      ).resolves.toBe(id)
      expect((await jobsContext.queue.getJob(id))?.data.payload).toEqual({
        value: 1,
      })
    })

    it("фильтрует задачи и проходит страницы без повторов", async () => {
      const other = defineJob("test.other")
      await jobsContext.service.add(other, null, { delay: 60_000 })
      const first = await jobsContext.service.add(
        jobsContext.definition,
        { value: 1 },
        { delay: 60_000 },
      )
      const second = await jobsContext.service.add(
        jobsContext.definition,
        { value: 2 },
        { delay: 60_000 },
      )
      await jobsContext.service.cancel(second)

      const page = await jobsContext.service.list(jobsContext.definition, {
        states: ["queued", "cancelled"],
        limit: 1,
      })
      const next = await jobsContext.service.list(jobsContext.definition, {
        states: ["queued", "cancelled"],
        cursor: page.cursor,
      })
      expect(page.hasMore).toBe(true)
      expect(next.hasMore).toBe(false)
      expect(
        new Set([...page.items, ...next.items].map((item) => item.id)),
      ).toEqual(new Set([first, second]))
      const cancelled = await jobsContext.service.list(jobsContext.definition, {
        states: ["cancelled"],
      })
      expect(cancelled.items).toEqual([
        expect.objectContaining({ id: second, state: "cancelled" }),
      ])
    })

    it("отменяет ожидающую задачу и не вызывает обработчик", async () => {
      const id = await jobsContext.service.add(jobsContext.definition, {
        value: 1,
      })
      await expect(jobsContext.service.cancel(id)).resolves.toBe(true)
      await expect(jobsContext.service.cancel(id)).resolves.toBe(true)
      await jobsContext.queue.resume()
      const job = await jobsContext.queue.getJob(id)
      const deadline = Date.now() + 10_000
      while ((await job?.getState()) !== "completed" && Date.now() < deadline) {
        await setTimeout(20)
      }
      expect(await job?.getState()).toBe("completed")
      expect((await jobsContext.queue.getJob(id))?.returnvalue).toBe(
        JOB_CANCELLED_RESULT,
      )
      expect(jobsContext.handle).not.toHaveBeenCalled()
      await expect(jobsContext.service.get(id)).resolves.toEqual(
        expect.objectContaining({ state: "cancelled" }),
      )
    })

    it("повторяет упавшую задачу вручную со сбросом отмены и попыток", async () => {
      jobsContext.handle.mockRejectedValueOnce(new NonRetryableJobError("stop"))
      const id = await jobsContext.service.add(jobsContext.definition, {
        value: 1,
      })
      await jobsContext.queue.resume()
      await jobsContext.waitForState(id, "failed")
      await jobsContext.queue.pause()
      const job = await jobsContext.queue.getJob(id)
      await job?.updateData({ ...job.data, cancellationState: "cancelled" })

      await jobsContext.service.retry(id)
      const retried = await jobsContext.queue.getJob(id)
      expect(retried?.data.cancellationState).toBe("none")
      expect(retried?.attemptsStarted).toBe(0)
      expect(retried?.attemptsMade).toBe(0)
      await jobsContext.queue.resume()
      await jobsContext.waitForState(id, "completed")
      expect(jobsContext.handle).toHaveBeenCalledTimes(2)
    })
  })
})
