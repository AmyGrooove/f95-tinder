import { setTimeout } from "node:timers/promises"
import { describe, expect, it } from "@jest/globals"

import { JobCancelledError } from "../../../errors/JobCancelledError"
import { NonRetryableJobError } from "../../../errors/NonRetryableJobError"
import { JOB_CANCELLED_RESULT } from "../../../static/JOB_CANCELLED_RESULT"
import type { IJobData } from "../../../types/IJobData"
import type { TJobState } from "@infrastructure/jobs/services/jobService"

import { createJobsTestContext } from "../../../__tests__/setup/createJobsTestContext"

describe("JobProcessorService", () => {
  const jobsContext = createJobsTestContext()

  describe("JobProcessorService", () => {
    it("исполняет найденный Nest-обработчик и сохраняет прогресс и результат", async () => {
      jobsContext.handle.mockImplementation(async (payload, context) => {
        await context.updateProgress({ progress: 100, status: "done" })
        return { value: payload.value * 2 }
      })
      const id = await jobsContext.service.add(jobsContext.definition, {
        value: 3,
      })
      await jobsContext.queue.resume()
      const details = await jobsContext.waitForState(id, "completed")

      expect(details).toEqual(
        expect.objectContaining({
          progress: 100,
          status: "done",
          attempt: 1,
          startedAt: expect.any(Date),
          finishedAt: expect.any(Date),
        }),
      )
      expect((await jobsContext.queue.getJob(id))?.returnvalue).toEqual({
        value: 6,
      })
      expect(jobsContext.handle).toHaveBeenCalledWith(
        { value: 3 },
        expect.objectContaining({ id, attempt: 1 }),
      )
      await expect(jobsContext.service.cancel(id)).resolves.toBe(false)
      await expect(
        jobsContext.service.update(jobsContext.definition, id, { value: 4 }),
      ).rejects.toThrow()
    })

    it("применяет интервалы автоматических повторов и увеличивает номер попытки", async () => {
      const started: number[] = []
      jobsContext.handle.mockImplementation(async (_payload, context) => {
        started.push(Date.now())
        if (context.attempt < 3) {
          throw new Error("temporary")
        }
        return "done"
      })
      const id = await jobsContext.service.add(jobsContext.definition, {
        value: 1,
      })
      await jobsContext.queue.resume()
      expect((await jobsContext.waitForState(id, "completed")).attempt).toBe(3)
      expect(jobsContext.handle).toHaveBeenCalledTimes(3)
      expect(started[1] - started[0]).toBeGreaterThanOrEqual(100)
      expect(started[2] - started[1]).toBeGreaterThanOrEqual(150)
    })

    it("исчерпывает повторы и сохраняет причину ошибки", async () => {
      jobsContext.handle.mockRejectedValue(new Error("persistent"))
      const id = await jobsContext.service.add(jobsContext.definition, {
        value: 1,
      })
      await jobsContext.queue.resume()
      expect(await jobsContext.waitForState(id, "failed")).toEqual(
        expect.objectContaining({ attempt: 3, failedReason: "persistent" }),
      )
      expect(jobsContext.handle).toHaveBeenCalledTimes(3)
    })

    it("не повторяет NonRetryableJobError автоматически", async () => {
      jobsContext.handle.mockRejectedValue(
        new NonRetryableJobError("permanent"),
      )
      const id = await jobsContext.service.add(jobsContext.definition, {
        value: 1,
      })
      await jobsContext.queue.resume()
      expect(await jobsContext.waitForState(id, "failed")).toEqual(
        expect.objectContaining({ attempt: 1, failedReason: "permanent" }),
      )
      expect(jobsContext.handle).toHaveBeenCalledTimes(1)
      expect(
        await jobsContext.queue.getJobCounts("delayed", "waiting"),
      ).toEqual({
        delayed: 0,
        waiting: 0,
      })
    })

    it.each(["missing-handler", "version", "envelope"])(
      "завершает несовместимую задачу без повторов: %s",
      async (kind) => {
        const data: IJobData = {
          name: jobsContext.definition.name,
          version: kind === "version" ? 2 : 1,
          retryDelays: [100],
          payload: {},
          cancellationState: "none",
        }
        const job = await jobsContext.queue.add(
          kind === "missing-handler" ? "unknown" : jobsContext.definition.name,
          kind === "envelope" ? {} : data,
          { attempts: 3 },
        )
        await jobsContext.queue.resume()
        if (job.id === undefined) {
          throw new Error("BullMQ не вернул идентификатор задачи")
        }
        const deadline = Date.now() + 10_000
        while ((await job.getState()) !== "failed" && Date.now() < deadline) {
          await setTimeout(20)
        }
        expect(await job.getState()).toBe("failed")
        expect((await jobsContext.queue.getJob(job.id))?.attemptsStarted).toBe(
          1,
        )
        expect(jobsContext.handle).not.toHaveBeenCalled()
      },
    )

    it("отменяет работающую задачу через контекст и сохраняет терминальное состояние", async () => {
      let isCancellationAccepted = false
      let observedState: TJobState | undefined
      let cancellationError: unknown
      jobsContext.handle.mockImplementation(async (_payload, context) => {
        isCancellationAccepted = await jobsContext.service.cancel(context.id)
        observedState = (await jobsContext.service.get(context.id))?.state
        try {
          await context.throwIfCancelled()
        } catch (error) {
          cancellationError = error
          throw error
        }
      })
      const id = await jobsContext.service.add(jobsContext.definition, {
        value: 1,
      })
      await jobsContext.queue.resume()
      await jobsContext.waitForState(id, "cancelled")
      expect(isCancellationAccepted).toBe(true)
      expect(observedState).toBe("cancelling")
      expect(cancellationError).toBeInstanceOf(JobCancelledError)
      expect((await jobsContext.queue.getJob(id))?.returnvalue).toBe(
        JOB_CANCELLED_RESULT,
      )
      expect(jobsContext.handle).toHaveBeenCalledTimes(1)
      await expect(jobsContext.service.retry(id)).rejects.toThrow()
    })
  })
})
