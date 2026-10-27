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
import { SchedulerRegistry } from "@nestjs/schedule"
import { Test, type TestingModule } from "@nestjs/testing"
import type { Queue } from "bullmq"
import { Types } from "mongoose"

import { EItemType } from "@entities/item/schemas/EItemType"
import { ItemTagRepository } from "@entities/itemTag/services/itemTag.repository"
import { NonRetryableJobError } from "@infrastructure/jobs/errors/NonRetryableJobError"
import { infrastructureConfiguration } from "@infrastructure/config/config.module"
import { DatabaseModule } from "@infrastructure/database/database.module"
import { JobRegistryService } from "@infrastructure/jobs/services/jobRegistry.service"
import { JobService } from "@infrastructure/jobs/services/job.service"
import { JOBS_QUEUE_NAME } from "@infrastructure/jobs/static/JOBS_QUEUE_NAME"
import { LoggerService } from "@infrastructure/logger/services/logger.service"
import { createTestConfiguration } from "@test/functions/createTestConfiguration"
import { getTestDatabase } from "@test/setup/setupDatabase"
import { getTestRedis } from "@test/setup/setupRedis"

import { RecalculateTagWeightModifiersJobHandler } from "../handlers/recalculateTagWeightModifiersJob.handler"
import { TagWeightModifiersSchedulerService } from "../services/tagWeightModifiersScheduler.service"
import { RECALCULATE_TAG_WEIGHT_MODIFIERS_JOB } from "../static/RECALCULATE_TAG_WEIGHT_MODIFIERS_JOB"
import { TagWeightModifiersModule } from "../tagWeightModifiers.module"
import { createCatalogueFixture } from "./functions/createCatalogueFixture"

describe("TagWeightModifiersModule", () => {
  let moduleRef: TestingModule | undefined
  let queue: Queue
  let scheduler: TagWeightModifiersSchedulerService
  let jobs: JobService

  const waitForState = async (id: string, state: string) => {
    const deadline = Date.now() + 10_000

    while (Date.now() < deadline) {
      const details = await jobs.get(id)

      if (
        details?.state === state &&
        (!["completed", "failed"].includes(state) ||
          details.finishedAt !== undefined)
      ) {
        return
      }

      await setTimeout(20)
    }

    throw new Error(`Задача ${id} не перешла в состояние ${state}`)
  }

  beforeEach(async () => {
    const configuration = createTestConfiguration(
      getTestDatabase().uri,
      getTestRedis().url,
    )
    moduleRef = await Test.createTestingModule({
      imports: [DatabaseModule, TagWeightModifiersModule],
    })
      .overrideProvider(infrastructureConfiguration.KEY)
      .useValue(configuration)
      .overrideProvider(LoggerService)
      .useValue({ info: jest.fn(), error: jest.fn() })
      .compile()
    queue = moduleRef.get<Queue>(getQueueToken(JOBS_QUEUE_NAME))
    jobs = moduleRef.get(JobService)
    scheduler = moduleRef.get(TagWeightModifiersSchedulerService)
    await queue.pause()
    await moduleRef.init()

    for (const cron of moduleRef
      .get(SchedulerRegistry)
      .getCronJobs()
      .values()) {
      await cron.stop()
    }
  })

  afterEach(async () => {
    await moduleRef?.close()
    moduleRef = undefined
  })

  it("считает уникальные Items и поддержки тегов, исключая чужие типы, группы, удалённые записи и сирот", async () => {
    const fixture = await createCatalogueFixture(getTestDatabase().connection)
    const repository = moduleRef?.get(ItemTagRepository)
    const genres = await repository?.getUsageCounts(
      [fixture.common._id, fixture.rare._id, fixture.unused._id],
      [EItemType.GAME, EItemType.MOVIE],
    )

    expect(genres).toEqual({
      itemCount: 6,
      tagCounts: expect.arrayContaining([
        { _id: fixture.common._id, count: 6 },
        { _id: fixture.rare._id, count: 1 },
      ]),
    })
    expect(genres?.tagCounts).toHaveLength(2)
    const mechanics = await repository?.getUsageCounts(
      [fixture.mechanic._id, fixture.rareMechanic._id],
      [EItemType.GAME],
    )
    expect(mechanics).toEqual({
      itemCount: 2,
      tagCounts: expect.arrayContaining([
        { _id: fixture.mechanic._id, count: 2 },
        { _id: fixture.rareMechanic._id, count: 1 },
      ]),
    })
    expect(mechanics?.tagCounts).toHaveLength(2)
  })

  it("возвращает нулевые счётчики для пустых входов и отсутствующих поддержек", async () => {
    const fixture = await createCatalogueFixture(getTestDatabase().connection)
    const repository = moduleRef?.get(ItemTagRepository)

    for (const [tags, types] of [
      [[], [EItemType.GAME]],
      [[fixture.common._id], []],
      [[fixture.unused._id], [EItemType.GAME]],
      [[new Types.ObjectId()], [EItemType.GAME]],
    ] satisfies [Types.ObjectId[], EItemType[]][]) {
      await expect(repository?.getUsageCounts(tags, types)).resolves.toEqual({
        itemCount: 0,
        tagCounts: [],
      })
    }
  })

  it("регистрирует обработчик, выполняет задачу через Redis и повторно получает те же коэффициенты без изменения других данных", async () => {
    const { connection } = getTestDatabase()
    const fixture = await createCatalogueFixture(connection)
    const registry = moduleRef?.get(JobRegistryService)
    expect(registry?.get(RECALCULATE_TAG_WEIGHT_MODIFIERS_JOB.name)).toEqual({
      definition: RECALCULATE_TAG_WEIGHT_MODIFIERS_JOB,
      handler: moduleRef?.get(RecalculateTagWeightModifiersJobHandler),
    })
    expect(await queue.getWaitingCount()).toBe(0)
    expect(await queue.getActiveCount()).toBe(0)
    const itemsBefore = await connection.collection("Item").find().toArray()
    const supportsBefore = await connection
      .collection("ItemTag")
      .find()
      .toArray()
    const id = await scheduler.enqueueRecalculation()
    await expect(scheduler.enqueueRecalculation()).resolves.toBe(id)
    expect((await queue.getJob(id))?.data).toEqual({
      name: "tag.recalculateWeightModifiers",
      version: 1,
      retryDelays: [5000, 30000, 120000],
      payload: null,
      cancellationState: "none",
    })
    await queue.resume()
    await waitForState(id, "completed")
    expect((await queue.getJob(id))?.returnvalue).toEqual({
      processedGroups: 12,
      updatedTags: 7,
    })
    const expected = new Map([
      [fixture.common.key, 0.25],
      [fixture.rare.key, 1.252762968495368],
      [fixture.unused.key, 1],
      [fixture.mechanic.key, 0.25],
      [fixture.rareMechanic.key, 0.4054651081081644],
      [fixture.empty.key, 1],
      [fixture.duration.key, 1],
      [fixture.audience.key, 1.75],
      [fixture.ungrouped.key, 1.75],
    ])

    for (const tag of fixture.tags) {
      const stored = await connection
        .collection("Tag")
        .findOne({ _id: tag._id })
      expect(stored).toEqual({
        ...tag,
        weightModifier: expected.get(tag.key),
        updatedAt:
          tag === fixture.audience || tag === fixture.ungrouped
            ? tag.updatedAt
            : expect.any(Date),
      })
    }

    expect(await connection.collection("Tag").countDocuments()).toBe(
      fixture.tags.length,
    )
    expect(await connection.collection("Item").find().toArray()).toEqual(
      itemsBefore,
    )
    expect(await connection.collection("ItemTag").find().toArray()).toEqual(
      supportsBefore,
    )
    const nextId = await scheduler.enqueueRecalculation()
    expect(nextId).not.toBe(id)
    await waitForState(nextId, "completed")

    for (const tag of fixture.tags) {
      expect(
        (await connection.collection("Tag").findOne({ _id: tag._id }))
          ?.weightModifier,
      ).toBe(expected.get(tag.key))
    }
  })

  it("подавляет дубли во время выполнения и ожидания повтора после ошибки", async () => {
    const handler = moduleRef?.get(RecalculateTagWeightModifiersJobHandler)

    if (handler === undefined) {
      throw new Error("Обработчик не зарегистрирован")
    }

    let resolve: (() => void) | undefined
    const pending = new Promise<void>((done) => {
      resolve = done
    })
    jest.spyOn(handler, "handle").mockImplementationOnce(async () => {
      await pending
      throw new Error("Temporary database error")
    })
    const id = await scheduler.enqueueRecalculation()

    try {
      await queue.resume()
      await waitForState(id, "running")
      await expect(scheduler.enqueueRecalculation()).resolves.toBe(id)
      await queue.pause()
      resolve?.()
      const deadline = Date.now() + 10_000

      while ((await queue.getJob(id))?.attemptsMade !== 1) {
        if (Date.now() > deadline) {
          throw new Error("Задача не перешла к повторной попытке")
        }

        await setTimeout(20)
      }

      expect(await (await queue.getJob(id))?.getState()).toBe("delayed")
      await expect(scheduler.enqueueRecalculation()).resolves.toBe(id)
      await queue.resume()
      await waitForState(id, "completed")
      expect((await queue.getJob(id))?.attemptsMade).toBe(2)
    } finally {
      resolve?.()
    }
  })

  it("разрешает новый запуск после окончательной ошибки предыдущего", async () => {
    const handler = moduleRef?.get(RecalculateTagWeightModifiersJobHandler)

    if (handler === undefined) {
      throw new Error("Обработчик не зарегистрирован")
    }

    jest
      .spyOn(handler, "handle")
      .mockRejectedValueOnce(new NonRetryableJobError("Permanent failure"))
    const id = await scheduler.enqueueRecalculation()
    await queue.resume()
    await waitForState(id, "failed")
    await queue.pause()
    const nextId = await scheduler.enqueueRecalculation()

    expect(nextId).not.toBe(id)
    await queue.resume()
    await waitForState(nextId, "completed")
  })
})
