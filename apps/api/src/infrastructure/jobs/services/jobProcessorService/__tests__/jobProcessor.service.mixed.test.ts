import { beforeEach, describe, expect, it, jest } from "@jest/globals"
import { UnrecoverableError, type Job, type Queue } from "bullmq"
import type { LoggerService } from "@infrastructure/logger/services/loggerService"
import { DICTIONARY } from "@shared/static/DICTIONARY"
import { JobCancelledError } from "../../../static/errors/JobCancelledError"
import { NonRetryableJobError } from "../../../static/errors/NonRetryableJobError"
import { defineJob } from "../../../functions/defineJob"
import { JobProcessorService } from "../core/jobProcessor.service"
import type { JobRegistryService } from "@infrastructure/jobs/services/jobRegistryService"
import { JOB_CANCELLED_RESULT } from "../../../static/JOB_CANCELLED_RESULT"
import { JOBS_QUEUE_NAME } from "../../../static/JOBS_QUEUE_NAME"
import type { IJobContext } from "../../../types/IJobContext"
import type { IJobData } from "../../../types/IJobData"
import type { IJobHandler } from "../../../types/IJobHandler"
import { setTimeout } from "node:timers/promises"
import type { TJobState } from "@infrastructure/jobs/services/jobService"

if (Reflect.get(globalThis, "IS_INTEGRATION_TEST") === true) {
  const { createJobsTestContext } =
    await import("../../../__tests__/setup/createJobsTestContext")

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
        expect((await jobsContext.waitForState(id, "completed")).attempt).toBe(
          3,
        )
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
            kind === "missing-handler"
              ? "unknown"
              : jobsContext.definition.name,
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
          expect(
            (await jobsContext.queue.getJob(job.id))?.attemptsStarted,
          ).toBe(1)
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
} else {
  describe("JobProcessorService", () => {
    const definition = defineJob("test.processor")
    const handle =
      jest.fn<
        (
          ...args: Parameters<IJobHandler<unknown>["handle"]>
        ) => Promise<unknown>
      >()
    const get = jest.fn<JobRegistryService["get"]>()
    const getJob = jest.fn<Queue["getJob"]>()
    const logger = {
      info: jest.fn<LoggerService["info"]>(),
      error: jest.fn<LoggerService["error"]>(),
    }
    const processor = new JobProcessorService(
      { getJob } as unknown as Queue,
      { get } as unknown as JobRegistryService,
      logger as unknown as LoggerService,
    )
    let data: IJobData
    let job: Job
    const updateData = jest.fn<Job["updateData"]>()
    const updateProgress = jest.fn<Job["updateProgress"]>()

    beforeEach(() => {
      jest.resetAllMocks()
      data = { ...definition, payload: { value: 1 }, cancellationState: "none" }
      job = {
        id: "job-id",
        name: definition.name,
        data,
        attemptsStarted: 2,
        updateData,
        updateProgress,
      } as unknown as Job
      get.mockReturnValue({ definition, handler: { handle } })
      getJob.mockResolvedValue(job)
      updateData.mockResolvedValue(undefined)
      updateProgress.mockResolvedValue(undefined)
      handle.mockResolvedValue({ result: 42 })
    })

    it("передаёт payload и контекст обработчику и возвращает его результат", async () => {
      await expect(processor.process(job)).resolves.toEqual({ result: 42 })
      expect(handle).toHaveBeenCalledWith(
        data.payload,
        expect.objectContaining({
          id: "job-id",
          attempt: 2,
          updateProgress: expect.any(Function),
          throwIfCancelled: expect.any(Function),
        }),
      )
      expect(getJob).toHaveBeenCalledTimes(2)
      expect(logger.info).toHaveBeenCalledWith(
        DICTIONARY.jobs.completed,
        expect.objectContaining({ jobId: "job-id" }),
      )
    })

    it.each([undefined, "", 12])(
      "отклоняет недопустимый идентификатор %p без вызова обработчика",
      async (id) => {
        job.id = id as string
        await expect(processor.process(job)).rejects.toThrow(
          new UnrecoverableError(DICTIONARY.jobs.missingId),
        )
        expect(handle).not.toHaveBeenCalled()
      },
    )

    it("логирует повреждённый конверт и запрещает повтор", async () => {
      job.data = null
      await expect(processor.process(job)).rejects.toThrow(UnrecoverableError)
      expect(logger.error).toHaveBeenCalledWith(
        DICTIONARY.jobs.invalidPersistedEnvelope,
        expect.any(Error),
        expect.objectContaining({ jobId: "job-id" }),
      )
      expect(handle).not.toHaveBeenCalled()
    })

    it("запрещает повтор при отсутствии обработчика", async () => {
      get.mockReturnValue(undefined)
      await expect(processor.process(job)).rejects.toThrow(
        new UnrecoverableError(DICTIONARY.jobs.handlerNotRegistered(job.name)),
      )
      expect(handle).not.toHaveBeenCalled()
    })

    it.each([{ name: "other" }, { version: 2 }])(
      "запрещает выполнение несовместимого конверта %p",
      async (overrides) => {
        Object.assign(data, overrides)
        await expect(processor.process(job)).rejects.toThrow(UnrecoverableError)
        expect(handle).not.toHaveBeenCalled()
      },
    )

    it.each([{ progress: 0 }, { progress: 100, status: "done" }])(
      "сохраняет допустимый прогресс %p",
      async (progress) => {
        handle.mockImplementation(async (_payload, context) =>
          context.updateProgress(progress),
        )
        await processor.process(job)
        expect(updateProgress).toHaveBeenCalledWith(progress)
      },
    )

    it.each([
      { progress: -1 },
      { progress: 101 },
      { progress: 0.5 },
      { progress: NaN },
      { progress: 10, status: 5 },
    ])("отклоняет недопустимый прогресс %p", async (progress) => {
      handle.mockImplementation(async (_payload, context) =>
        context.updateProgress(
          progress as Parameters<IJobContext["updateProgress"]>[0],
        ),
      )
      await expect(processor.process(job)).rejects.toThrow(
        DICTIONARY.jobs.invalidProgress,
      )
      expect(updateProgress).not.toHaveBeenCalled()
    })

    it.each(["cancelled", "cancelling"] as const)(
      "не запускает обработчик при отмене %s",
      async (cancellationState) => {
        data.cancellationState = cancellationState
        await expect(processor.process(job)).resolves.toBe(JOB_CANCELLED_RESULT)
        expect(handle).not.toHaveBeenCalled()
        expect(updateData).toHaveBeenCalledWith({
          ...data,
          cancellationState: "cancelled",
        })
      },
    )

    it("считает исчезнувшую задачу отменённой", async () => {
      getJob.mockResolvedValue(undefined)
      await expect(processor.process(job)).resolves.toBe(JOB_CANCELLED_RESULT)
      expect(handle).not.toHaveBeenCalled()
      expect(updateData).not.toHaveBeenCalled()
    })

    it("обнаруживает запрос отмены после завершения обработчика", async () => {
      handle.mockImplementation(async () => {
        data.cancellationState = "cancelling"
        return "result"
      })
      await expect(processor.process(job)).resolves.toBe(JOB_CANCELLED_RESULT)
      expect(updateData).toHaveBeenCalledWith({
        ...data,
        cancellationState: "cancelled",
      })
    })

    it("обработчик может проверить отмену через контекст", async () => {
      handle.mockImplementation(async (_payload, context) => {
        data.cancellationState = "cancelling"
        await context.throwIfCancelled()
      })
      await expect(processor.process(job)).resolves.toBe(JOB_CANCELLED_RESULT)
      expect(logger.info).toHaveBeenCalledWith(
        DICTIONARY.jobs.cancelled,
        expect.objectContaining({ jobId: "job-id" }),
      )
    })

    it("обрабатывает JobCancelledError как отмену", async () => {
      handle.mockRejectedValue(new JobCancelledError("cancel"))
      await expect(processor.process(job)).resolves.toBe(JOB_CANCELLED_RESULT)
    })

    it("отдаёт приоритет отмене при ошибке обработчика", async () => {
      handle.mockImplementation(async () => {
        data.cancellationState = "cancelling"
        throw new Error("failed")
      })
      await expect(processor.process(job)).resolves.toBe(JOB_CANCELLED_RESULT)
      expect(logger.error).not.toHaveBeenCalled()
    })

    it("сохраняет обычную ошибку для автоматического повтора", async () => {
      const error = new Error("retry")
      handle.mockRejectedValue(error)
      await expect(processor.process(job)).rejects.toBe(error)
      expect(logger.error).toHaveBeenCalledWith(
        DICTIONARY.jobs.handlerFailed,
        error,
        expect.objectContaining({ jobId: "job-id" }),
      )
    })

    it("преобразует NonRetryableJobError в UnrecoverableError", async () => {
      handle.mockRejectedValue(new NonRetryableJobError("stop"))
      await expect(processor.process(job)).rejects.toThrow(
        new UnrecoverableError("stop"),
      )
    })

    it("преобразует выброшенное значение в Error", async () => {
      handle.mockRejectedValue("failure")
      await expect(processor.process(job)).rejects.toThrow(
        DICTIONARY.jobs.handlerFailed,
      )
    })

    it("логирует ошибку worker с именем очереди", () => {
      const error = new Error("worker failed")
      processor.onWorkerError(error)
      expect(logger.error).toHaveBeenCalledWith(
        DICTIONARY.jobs.workerError,
        error,
        { context: JobProcessorService.name, data: { queue: JOBS_QUEUE_NAME } },
      )
    })
  })
}
