import { beforeEach, describe, expect, it, jest } from "@jest/globals"
import type { Job, Queue } from "bullmq"

import { DICTIONARY } from "@shared/static/DICTIONARY"

import { defineJob } from "../functions/defineJob"
import { JobService } from "../services/job.service"
import { JOBS_SETTINGS } from "../static/JOBS_SETTINGS"
import type { IJobData } from "../types/IJobData"

describe("JobService", () => {
  const definition = defineJob<{ value: number }>("test.job", {
    version: 2,
    retryDelays: [10, 20],
  })
  const queue = {
    add: jest.fn<Queue["add"]>(),
    getJob: jest.fn<Queue["getJob"]>(),
    getJobs: jest.fn<Queue["getJobs"]>(),
  }
  const service = new JobService(queue as unknown as Queue)
  const createJob = (state = "waiting", overrides: Partial<IJobData> = {}) => {
    const data: IJobData = {
      ...definition,
      payload: { value: 1 },
      cancellationState: "none",
      ...overrides,
    }
    const job = {
      id: "job-id",
      name: definition.name,
      data,
      timestamp: 1000,
      attemptsStarted: 0,
      progress: 0,
      getState: jest
        .fn<Job["getState"]>()
        .mockResolvedValue(state as Awaited<ReturnType<Job["getState"]>>),
      updateData: jest.fn<Job["updateData"]>().mockResolvedValue(undefined),
      retry: jest.fn<Job["retry"]>().mockResolvedValue(undefined),
    }
    return {
      job: job as unknown as Job,
      updateData: job.updateData,
      retry: job.retry,
      data,
    }
  }

  beforeEach(() => {
    jest.resetAllMocks()
    queue.getJobs.mockResolvedValue([])
  })

  it("создаёт конверт задачи и передаёт настройки повторов, хранения и дедупликации", async () => {
    const { job } = createJob()
    queue.add.mockResolvedValue(job)
    const options = {
      jobId: "custom",
      delay: 0,
      deduplication: { id: "unique" },
    }

    await expect(service.add(definition, { value: 3 }, options)).resolves.toBe(
      job.id,
    )
    expect(queue.add).toHaveBeenCalledWith(
      definition.name,
      {
        name: definition.name,
        version: 2,
        retryDelays: [10, 20],
        payload: { value: 3 },
        cancellationState: "none",
      },
      {
        ...options,
        attempts: 3,
        backoff: { type: "custom" },
        removeOnComplete: JOBS_SETTINGS.removeOnComplete,
        removeOnFail: JOBS_SETTINGS.removeOnFail,
      },
    )
  })

  it("создаёт задачу без автоматических повторов", async () => {
    queue.add.mockResolvedValue(createJob().job)
    await service.add(defineJob("single"), null)

    expect(queue.add).toHaveBeenCalledWith(
      "single",
      expect.anything(),
      expect.objectContaining({ attempts: 1, backoff: undefined }),
    )
  })

  it.each([-1, 0.5, NaN, Infinity])(
    "отклоняет недопустимую задержку %p до записи",
    async (delay) => {
      await expect(
        service.add(definition, { value: 1 }, { delay }),
      ).rejects.toThrow(DICTIONARY.jobs.invalidDelay)
      expect(queue.add).not.toHaveBeenCalled()
    },
  )

  it("отклоняет результат постановки без идентификатора", async () => {
    queue.add.mockResolvedValue({ id: undefined } as Job)
    await expect(service.add(definition, { value: 1 })).rejects.toThrow(
      DICTIONARY.jobs.missingQueuedId,
    )
  })

  it("возвращает null для отсутствующей задачи", async () => {
    await expect(service.get("missing")).resolves.toBeNull()
  })

  it("возвращает публичные сведения о задаче", async () => {
    queue.getJob.mockResolvedValue(createJob().job)
    await expect(service.get("job-id")).resolves.toEqual(
      expect.objectContaining({
        id: "job-id",
        name: definition.name,
        state: "queued",
        createdAt: new Date(1000),
        progress: 0,
        attempt: 0,
      }),
    )
  })

  it("обновляет только payload ожидающей задачи", async () => {
    const { job, data, updateData } = createJob()
    queue.getJob.mockResolvedValue(job)
    await service.update(definition, "job-id", { value: 5 })

    expect(updateData).toHaveBeenCalledWith({ ...data, payload: { value: 5 } })
  })

  it.each([{ name: "other" }, { version: 3 }])(
    "отклоняет обновление несовместимого конверта %p",
    async (overrides) => {
      const { job, updateData } = createJob("waiting", overrides)
      queue.getJob.mockResolvedValue(job)
      await expect(
        service.update(definition, "job-id", { value: 2 }),
      ).rejects.toThrow(
        DICTIONARY.jobs.definitionMismatch("job-id", definition.name),
      )
      expect(updateData).not.toHaveBeenCalled()
    },
  )

  it("отклоняет обновление задачи другой очередной операции", async () => {
    const { job } = createJob()
    job.name = "other"
    queue.getJob.mockResolvedValue(job)
    await expect(
      service.update(definition, "job-id", { value: 2 }),
    ).rejects.toThrow(
      DICTIONARY.jobs.definitionMismatch("job-id", definition.name),
    )
  })

  it.each(["active", "completed", "failed"])(
    "не обновляет задачу в состоянии %s",
    async (state) => {
      const { job, updateData } = createJob(state)
      queue.getJob.mockResolvedValue(job)
      await expect(
        service.update(definition, "job-id", { value: 2 }),
      ).rejects.toThrow()
      expect(updateData).not.toHaveBeenCalled()
    },
  )

  it("возвращает false при отмене отсутствующей задачи", async () => {
    await expect(service.cancel("missing")).resolves.toBe(false)
  })

  it.each(["completed", "failed"])(
    "не отменяет завершённую задачу %s",
    async (state) => {
      const { job, updateData } = createJob(state)
      queue.getJob.mockResolvedValue(job)
      await expect(service.cancel("job-id")).resolves.toBe(false)
      expect(updateData).not.toHaveBeenCalled()
    },
  )

  it.each([
    ["waiting", "cancelled"],
    ["delayed", "cancelled"],
    ["active", "cancelling"],
  ] as const)("меняет отмену %s на %s", async (state, cancellationState) => {
    const { job, data, updateData } = createJob(state)
    queue.getJob.mockResolvedValue(job)
    await expect(service.cancel("job-id")).resolves.toBe(true)
    expect(updateData).toHaveBeenCalledWith({ ...data, cancellationState })
  })

  it.each(["cancelled", "cancelling"] as const)(
    "повторная отмена %s идемпотентна",
    async (cancellationState) => {
      const { job, updateData } = createJob("waiting", { cancellationState })
      queue.getJob.mockResolvedValue(job)
      await expect(service.cancel("job-id")).resolves.toBe(true)
      expect(updateData).not.toHaveBeenCalled()
    },
  )

  it.each(["none", "cancelled", "cancelling"] as const)(
    "повторяет упавшую задачу с отменой %s и сбрасывает попытки",
    async (cancellationState) => {
      const { job, data, updateData, retry } = createJob("failed", {
        cancellationState,
      })
      queue.getJob.mockResolvedValue(job)
      await service.retry("job-id")

      expect(retry).toHaveBeenCalledWith("failed", {
        resetAttemptsMade: true,
        resetAttemptsStarted: true,
      })
      if (cancellationState === "none") {
        expect(updateData).not.toHaveBeenCalled()
      } else {
        expect(updateData).toHaveBeenCalledWith({
          ...data,
          cancellationState: "none",
        })
      }
    },
  )

  it.each(["waiting", "active", "completed"])(
    "не повторяет задачу %s",
    async (state) => {
      const { job, retry } = createJob(state)
      queue.getJob.mockResolvedValue(job)
      await expect(service.retry("job-id")).rejects.toThrow()
      expect(retry).not.toHaveBeenCalled()
    },
  )

  it("сообщает об отсутствии задачи при обновлении и повторе", async () => {
    await expect(
      service.update(definition, "missing", { value: 2 }),
    ).rejects.toThrow(DICTIONARY.jobs.notFound("missing"))
    await expect(service.retry("missing")).rejects.toThrow(
      DICTIONARY.jobs.notFound("missing"),
    )
  })

  it.each([
    { limit: 0 },
    { limit: 101 },
    { limit: 1.5 },
    { cursor: "-1:0" },
    { cursor: "8:0" },
    { cursor: "0:-1" },
    { cursor: "bad" },
  ])("отклоняет некорректную пагинацию %p", async (options) => {
    await expect(service.list(definition, options)).rejects.toThrow(
      DICTIONARY.jobs.invalidListRange,
    )
    expect(queue.getJobs).not.toHaveBeenCalled()
  })

  it("возвращает пустой список без продолжения при отсутствии задач", async () => {
    await expect(service.list(definition)).resolves.toEqual({
      items: [],
      hasMore: false,
    })
  })

  it("фильтрует чужие имена и логические состояния и продолжает с курсора", async () => {
    const other = createJob("active").job
    other.name = "other"
    const running = createJob("active").job
    const cancelling = createJob("active", {
      cancellationState: "cancelling",
    }).job
    queue.getJobs.mockResolvedValueOnce([other, running, cancelling])

    const page = await service.list(definition, {
      states: ["cancelling"],
      limit: 1,
    })
    expect(page).toEqual({
      items: [expect.objectContaining({ state: "cancelling" })],
      hasMore: true,
      cursor: "0:3",
    })
    await service.list(definition, {
      states: ["cancelling"],
      cursor: page.cursor,
    })
    expect(queue.getJobs).toHaveBeenNthCalledWith(2, "active", 3, 102)
  })

  it("ограничивает просмотр пятьюстами задачами даже без совпадений", async () => {
    const other = createJob().job
    other.name = "other"
    queue.getJobs.mockResolvedValue(Array.from({ length: 100 }, () => other))

    await expect(service.list(definition)).resolves.toEqual({
      items: [],
      hasMore: true,
      cursor: "0:500",
    })
    expect(queue.getJobs).toHaveBeenCalledTimes(5)
  })

  it.each([
    ["completed", "completed"],
    ["failed", "failed"],
    ["queued", "waiting"],
    ["running", "active"],
  ] as const)(
    "выбирает состояние очереди для фильтра %s",
    async (state, queueState) => {
      await service.list(definition, { states: [state] })
      expect(queue.getJobs).toHaveBeenCalledWith(queueState, 0, 99)
      if (state !== "queued") {
        expect(queue.getJobs).toHaveBeenCalledTimes(1)
      }
    },
  )

  it("не читает очередь при пустом наборе состояний", async () => {
    await expect(service.list(definition, { states: [] })).resolves.toEqual({
      items: [],
      hasMore: false,
    })
    expect(queue.getJobs).not.toHaveBeenCalled()
  })

  it("передаёт ошибки очереди вызывающему коду", async () => {
    const error = new Error("Redis unavailable")
    queue.getJob.mockRejectedValue(error)
    await expect(service.get("job-id")).rejects.toBe(error)
  })
})
