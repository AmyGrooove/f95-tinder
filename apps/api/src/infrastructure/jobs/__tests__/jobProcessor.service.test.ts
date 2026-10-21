import { beforeEach, describe, expect, it, jest } from "@jest/globals"
import { UnrecoverableError, type Job, type Queue } from "bullmq"

import type { LoggerService } from "@infrastructure/logger/services/logger.service"
import { DICTIONARY } from "@shared/static/DICTIONARY"

import { JobCancelledError } from "../errors/JobCancelledError"
import { NonRetryableJobError } from "../errors/NonRetryableJobError"
import { defineJob } from "../functions/defineJob"
import { JobProcessorService } from "../services/jobProcessor.service"
import type { JobRegistryService } from "../services/jobRegistry.service"
import { JOB_CANCELLED_RESULT } from "../static/JOB_CANCELLED_RESULT"
import { JOBS_QUEUE_NAME } from "../static/JOBS_QUEUE_NAME"
import type { IJobContext } from "../types/IJobContext"
import type { IJobData } from "../types/IJobData"
import type { IJobHandler } from "../types/IJobHandler"

describe("JobProcessorService", () => {
  const definition = defineJob("test.processor")
  const handle =
    jest.fn<
      (...args: Parameters<IJobHandler<unknown>["handle"]>) => Promise<unknown>
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
