import { setTimeout } from "node:timers/promises"
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals"
import { getQueueToken } from "@nestjs/bullmq"
import { DiscoveryModule } from "@nestjs/core"
import { Test, type TestingModule } from "@nestjs/testing"
import type { Queue } from "bullmq"

import { infrastructureConfiguration } from "@infrastructure/config/config.module"
import { InfrastructureConfigService } from "@infrastructure/config/services/config.service"
import { LoggerService } from "@infrastructure/logger/services/logger.service"
import { DICTIONARY } from "@shared/static/DICTIONARY"
import { getTestApplication } from "@test/setup/setupIntegration"

import { JobHandler } from "../decorators/JobHandler"
import { JobCancelledError } from "../errors/JobCancelledError"
import { NonRetryableJobError } from "../errors/NonRetryableJobError"
import { defineJob } from "../functions/defineJob"
import { JobsModule } from "../jobs.module"
import { JobService } from "../services/job.service"
import { JobRegistryService } from "../services/jobRegistry.service"
import { JobsHealthService } from "../services/jobsHealth.service"
import { JOB_CANCELLED_RESULT } from "../static/JOB_CANCELLED_RESULT"
import { JOBS_QUEUE_NAME } from "../static/JOBS_QUEUE_NAME"
import type { IJobContext } from "../types/IJobContext"
import type { IJobData } from "../types/IJobData"
import type { IJobHandler } from "../types/IJobHandler"
import type { TJobState } from "../types/TJobState"

describe("JobsModule Redis", () => {
  const definition = defineJob<{ value: number }>("test.integration", {
    retryDelays: [100, 150],
  })
  const handle =
    jest.fn<
      (
        ...args: Parameters<IJobHandler<{ value: number }>["handle"]>
      ) => Promise<unknown>
    >()

  @JobHandler(definition)
  class Handler {
    handle(payload: { value: number }, context: IJobContext) {
      return handle(payload, context)
    }
  }

  let moduleRef: TestingModule | undefined
  let service: JobService
  let queue: Queue
  let health: JobsHealthService

  const waitForState = async (id: string, state: TJobState) => {
    const deadline = Date.now() + 10_000
    while (Date.now() < deadline) {
      const details = await service.get(id)
      if (
        details?.state === state &&
        (state !== "cancelled" ||
          (await (await queue.getJob(id))?.getState()) === "completed")
      ) {
        return details
      }
      await setTimeout(20)
    }
    throw new Error(
      `Задача ${id}: ожидалось ${state}, получено ${JSON.stringify(await service.get(id))}`,
    )
  }

  beforeEach(async () => {
    handle.mockReset().mockResolvedValue({ result: "done" })
    const configuration = getTestApplication().app.get(
      InfrastructureConfigService,
    )
    moduleRef = await Test.createTestingModule({
      imports: [JobsModule],
      providers: [Handler],
    })
      .overrideProvider(infrastructureConfiguration.KEY)
      .useValue({ app: configuration.app, redis: configuration.redis })
      .overrideProvider(LoggerService)
      .useValue({ info: jest.fn(), error: jest.fn() })
      .compile()
    queue = moduleRef.get<Queue>(getQueueToken(JOBS_QUEUE_NAME))
    service = moduleRef.get(JobService)
    health = moduleRef.get(JobsHealthService)
    await queue.pause()
    await moduleRef.init()
  })

  afterEach(async () => {
    await moduleRef?.close()
    moduleRef = undefined
  })

  describe("JobService", () => {
    it("сохраняет конверт и обновляет отложенную задачу в Redis", async () => {
      const id = await service.add(
        definition,
        { value: 1 },
        { jobId: "custom-id", delay: 60_000 },
      )
      expect(id).toBe("custom-id")
      expect((await queue.getJob(id))?.data).toEqual({
        name: definition.name,
        version: 1,
        retryDelays: [100, 150],
        payload: { value: 1 },
        cancellationState: "none",
      })
      await service.update(definition, id, { value: 2 })
      expect((await queue.getJob(id))?.data.payload).toEqual({ value: 2 })
      await expect(service.get(id)).resolves.toEqual(
        expect.objectContaining({ id, state: "queued", attempt: 0 }),
      )
      await expect(service.get("missing")).resolves.toBeNull()
    })

    it("дедуплицирует отложенные задачи по заданному ключу", async () => {
      const options = { delay: 60_000, deduplication: { id: "unique" } }
      const id = await service.add(definition, { value: 1 }, options)
      await expect(
        service.add(definition, { value: 2 }, options),
      ).resolves.toBe(id)
      expect((await queue.getJob(id))?.data.payload).toEqual({ value: 1 })
    })

    it("фильтрует задачи и проходит страницы без повторов", async () => {
      const other = defineJob("test.other")
      await service.add(other, null, { delay: 60_000 })
      const first = await service.add(
        definition,
        { value: 1 },
        { delay: 60_000 },
      )
      const second = await service.add(
        definition,
        { value: 2 },
        { delay: 60_000 },
      )
      await service.cancel(second)

      const page = await service.list(definition, {
        states: ["queued", "cancelled"],
        limit: 1,
      })
      const next = await service.list(definition, {
        states: ["queued", "cancelled"],
        cursor: page.cursor,
      })
      expect(page.hasMore).toBe(true)
      expect(next.hasMore).toBe(false)
      expect(
        new Set([...page.items, ...next.items].map((item) => item.id)),
      ).toEqual(new Set([first, second]))
      const cancelled = await service.list(definition, {
        states: ["cancelled"],
      })
      expect(cancelled.items).toEqual([
        expect.objectContaining({ id: second, state: "cancelled" }),
      ])
    })

    it("отменяет ожидающую задачу и не вызывает обработчик", async () => {
      const id = await service.add(definition, { value: 1 })
      await expect(service.cancel(id)).resolves.toBe(true)
      await expect(service.cancel(id)).resolves.toBe(true)
      await queue.resume()
      const job = await queue.getJob(id)
      const deadline = Date.now() + 10_000
      while ((await job?.getState()) !== "completed" && Date.now() < deadline) {
        await setTimeout(20)
      }
      expect(await job?.getState()).toBe("completed")
      expect((await queue.getJob(id))?.returnvalue).toBe(JOB_CANCELLED_RESULT)
      expect(handle).not.toHaveBeenCalled()
      await expect(service.get(id)).resolves.toEqual(
        expect.objectContaining({ state: "cancelled" }),
      )
    })

    it("повторяет упавшую задачу вручную со сбросом отмены и попыток", async () => {
      handle.mockRejectedValueOnce(new NonRetryableJobError("stop"))
      const id = await service.add(definition, { value: 1 })
      await queue.resume()
      await waitForState(id, "failed")
      await queue.pause()
      const job = await queue.getJob(id)
      await job?.updateData({ ...job.data, cancellationState: "cancelled" })

      await service.retry(id)
      const retried = await queue.getJob(id)
      expect(retried?.data.cancellationState).toBe("none")
      expect(retried?.attemptsStarted).toBe(0)
      expect(retried?.attemptsMade).toBe(0)
      await queue.resume()
      await waitForState(id, "completed")
      expect(handle).toHaveBeenCalledTimes(2)
    })
  })

  describe("JobProcessorService", () => {
    it("исполняет найденный Nest-обработчик и сохраняет прогресс и результат", async () => {
      handle.mockImplementation(async (payload, context) => {
        await context.updateProgress({ progress: 100, status: "done" })
        return { value: payload.value * 2 }
      })
      const id = await service.add(definition, { value: 3 })
      await queue.resume()
      const details = await waitForState(id, "completed")

      expect(details).toEqual(
        expect.objectContaining({
          progress: 100,
          status: "done",
          attempt: 1,
          startedAt: expect.any(Date),
          finishedAt: expect.any(Date),
        }),
      )
      expect((await queue.getJob(id))?.returnvalue).toEqual({ value: 6 })
      expect(handle).toHaveBeenCalledWith(
        { value: 3 },
        expect.objectContaining({ id, attempt: 1 }),
      )
      await expect(service.cancel(id)).resolves.toBe(false)
      await expect(
        service.update(definition, id, { value: 4 }),
      ).rejects.toThrow()
    })

    it("применяет интервалы автоматических повторов и увеличивает номер попытки", async () => {
      const started: number[] = []
      handle.mockImplementation(async (_payload, context) => {
        started.push(Date.now())
        if (context.attempt < 3) {
          throw new Error("temporary")
        }
        return "done"
      })
      const id = await service.add(definition, { value: 1 })
      await queue.resume()
      expect((await waitForState(id, "completed")).attempt).toBe(3)
      expect(handle).toHaveBeenCalledTimes(3)
      expect(started[1] - started[0]).toBeGreaterThanOrEqual(100)
      expect(started[2] - started[1]).toBeGreaterThanOrEqual(150)
    })

    it("исчерпывает повторы и сохраняет причину ошибки", async () => {
      handle.mockRejectedValue(new Error("persistent"))
      const id = await service.add(definition, { value: 1 })
      await queue.resume()
      expect(await waitForState(id, "failed")).toEqual(
        expect.objectContaining({ attempt: 3, failedReason: "persistent" }),
      )
      expect(handle).toHaveBeenCalledTimes(3)
    })

    it("не повторяет NonRetryableJobError автоматически", async () => {
      handle.mockRejectedValue(new NonRetryableJobError("permanent"))
      const id = await service.add(definition, { value: 1 })
      await queue.resume()
      expect(await waitForState(id, "failed")).toEqual(
        expect.objectContaining({ attempt: 1, failedReason: "permanent" }),
      )
      expect(handle).toHaveBeenCalledTimes(1)
      expect(await queue.getJobCounts("delayed", "waiting")).toEqual({
        delayed: 0,
        waiting: 0,
      })
    })

    it.each(["missing-handler", "version", "envelope"])(
      "завершает несовместимую задачу без повторов: %s",
      async (kind) => {
        const data: IJobData = {
          name: definition.name,
          version: kind === "version" ? 2 : 1,
          retryDelays: [100],
          payload: {},
          cancellationState: "none",
        }
        const job = await queue.add(
          kind === "missing-handler" ? "unknown" : definition.name,
          kind === "envelope" ? {} : data,
          { attempts: 3 },
        )
        await queue.resume()
        if (job.id === undefined) {
          throw new Error("BullMQ не вернул идентификатор задачи")
        }
        const deadline = Date.now() + 10_000
        while ((await job.getState()) !== "failed" && Date.now() < deadline) {
          await setTimeout(20)
        }
        expect(await job.getState()).toBe("failed")
        expect((await queue.getJob(job.id))?.attemptsStarted).toBe(1)
        expect(handle).not.toHaveBeenCalled()
      },
    )

    it("отменяет работающую задачу через контекст и сохраняет терминальное состояние", async () => {
      let isCancellationAccepted = false
      let observedState: TJobState | undefined
      let cancellationError: unknown
      handle.mockImplementation(async (_payload, context) => {
        isCancellationAccepted = await service.cancel(context.id)
        observedState = (await service.get(context.id))?.state
        try {
          await context.throwIfCancelled()
        } catch (error) {
          cancellationError = error
          throw error
        }
      })
      const id = await service.add(definition, { value: 1 })
      await queue.resume()
      await waitForState(id, "cancelled")
      expect(isCancellationAccepted).toBe(true)
      expect(observedState).toBe("cancelling")
      expect(cancellationError).toBeInstanceOf(JobCancelledError)
      expect((await queue.getJob(id))?.returnvalue).toBe(JOB_CANCELLED_RESULT)
      expect(handle).toHaveBeenCalledTimes(1)
      await expect(service.retry(id)).rejects.toThrow()
    })
  })

  describe("JobRegistryService", () => {
    it("обнаруживает провайдер по декоратору при инициализации Nest", () => {
      expect(moduleRef?.get(JobRegistryService).get(definition.name)).toEqual({
        definition,
        handler: moduleRef?.get(Handler),
      })
      expect(moduleRef?.get(JobRegistryService).get("missing")).toBeUndefined()
    })

    it("отклоняет дублирующие имена при инициализации Nest", async () => {
      @JobHandler(definition)
      class Duplicate extends Handler {}
      const duplicateModule = await Test.createTestingModule({
        imports: [DiscoveryModule],
        providers: [JobRegistryService, Handler, Duplicate],
      }).compile()
      try {
        await expect(duplicateModule.init()).rejects.toThrow(
          DICTIONARY.jobs.multipleHandlers(definition.name),
        )
      } finally {
        await duplicateModule.close()
      }
    })
  })

  describe("JobsHealthService", () => {
    it("проверяет пустую и заполненную очередь без изменения задач", async () => {
      await expect(health.checkHealth()).resolves.toBe(true)
      const id = await service.add(definition, { value: 1 }, { delay: 60_000 })
      await expect(health.checkHealth()).resolves.toBe(true)
      expect(await queue.getJobCounts("delayed")).toEqual({ delayed: 1 })
      expect((await queue.getJob(id))?.data.payload).toEqual({ value: 1 })
    })
  })
})
