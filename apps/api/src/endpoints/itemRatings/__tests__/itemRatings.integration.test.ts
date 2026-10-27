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
import { ItemRepository } from "@entities/item/services/item.repository"
import { ItemMetricRepository } from "@entities/itemMetric/services/itemMetric.repository"
import { EUserItemStatus } from "@entities/userItem/schemas/EUserItemStatus"
import { UserItemRepository } from "@entities/userItem/services/userItem.repository"
import { infrastructureConfiguration } from "@infrastructure/config/config.module"
import { DatabaseModule } from "@infrastructure/database/database.module"
import { JobRegistryService } from "@infrastructure/jobs/services/jobRegistry.service"
import { JobService } from "@infrastructure/jobs/services/job.service"
import { JOBS_QUEUE_NAME } from "@infrastructure/jobs/static/JOBS_QUEUE_NAME"
import type { IJobContext } from "@infrastructure/jobs/types/IJobContext"
import { LoggerService } from "@infrastructure/logger/services/logger.service"
import { createTestConfiguration } from "@test/functions/createTestConfiguration"
import { getTestDatabase } from "@test/setup/setupDatabase"
import { getTestRedis } from "@test/setup/setupRedis"

import { RecalculateItemRatingsJobHandler } from "../handlers/recalculateItemRatingsJob.handler"
import { ItemRatingsModule } from "../itemRatings.module"
import { ItemRatingsSchedulerService } from "../services/itemRatingsScheduler.service"
import { RECALCULATE_ITEM_RATINGS_JOB } from "../static/RECALCULATE_ITEM_RATINGS_JOB"

describe("ItemRatingsModule", () => {
  let moduleRef: TestingModule
  let queue: Queue
  let jobs: JobService
  let handler: RecalculateItemRatingsJobHandler
  let scheduler: ItemRatingsSchedulerService
  let items: ItemRepository
  let userItems: UserItemRepository
  let metrics: ItemMetricRepository

  const context = {
    id: "integration-ratings",
    attempt: 1,
    throwIfCancelled: async () => {},
    updateProgress: async () => {},
  } satisfies IJobContext
  const createItem = async () => {
    return await items.write.create({
      type: EItemType.MOVIE,
      title: { ru: null, en: "Rated movie" },
    })
  }
  const createRating = async (item: Types.ObjectId, rating: number | null) => {
    return await userItems.write.create({
      item,
      rating,
      user: new Types.ObjectId(),
      status: EUserItemStatus.PLANNED,
    })
  }
  const waitForCompletion = async (id: string) => {
    const deadline = Date.now() + 15_000

    while (Date.now() < deadline) {
      const details = await jobs.get(id)

      if (details?.state === "failed") {
        throw new Error(`Задача ${id} завершилась с ошибкой`)
      }

      if (details?.state === "completed" && details.finishedAt !== undefined) {
        return
      }

      await setTimeout(20)
    }

    throw new Error(`Задача ${id} не завершилась за отведённое время`)
  }

  beforeEach(async () => {
    await Promise.all(
      ["Item", "ItemMetric", "UserItem"].map(async (name) => {
        await getTestDatabase().connection.collection(name).deleteMany({})
      }),
    )

    const configuration = createTestConfiguration(
      getTestDatabase().uri,
      getTestRedis().url,
    )
    moduleRef = await Test.createTestingModule({
      imports: [DatabaseModule, ItemRatingsModule],
    })
      .overrideProvider(infrastructureConfiguration.KEY)
      .useValue(configuration)
      .overrideProvider(LoggerService)
      .useValue({ info: jest.fn(), error: jest.fn() })
      .compile()
    queue = moduleRef.get<Queue>(getQueueToken(JOBS_QUEUE_NAME))
    jobs = moduleRef.get(JobService)
    handler = moduleRef.get(RecalculateItemRatingsJobHandler)
    scheduler = moduleRef.get(ItemRatingsSchedulerService)
    items = moduleRef.get(ItemRepository)
    userItems = moduleRef.get(UserItemRepository)
    metrics = moduleRef.get(ItemMetricRepository)
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
  })

  it("считает оценки разных пользователей отдельно по Item, включая blocked, и игнорирует null и отсутствующее поле", async () => {
    const first = await createItem()
    const second = await createItem()
    await createRating(first._id, 1)
    await createRating(first._id, 10)
    const blocked = await createRating(first._id, 8)
    await userItems.write.updateById(String(blocked._id), {
      $set: { status: EUserItemStatus.BLOCKED },
    })
    await createRating(first._id, null)
    await getTestDatabase().connection.collection("UserItem").insertOne({
      item: first._id,
      user: new Types.ObjectId(),
      status: EUserItemStatus.PLANNED,
    })
    await createRating(second._id, 1)
    await handler.handle(null, context)

    const firstMetric = await metrics.read.findOne({ item: first._id })
    expect(firstMetric?.ratingAverage).toBeCloseTo(19 / 3, 12)
    expect(firstMetric?.ratingsCount).toBe(3)
    expect(await metrics.read.findOne({ item: second._id })).toMatchObject({
      ratingAverage: 1,
      ratingsCount: 1,
    })
    await expect(userItems.getRatingSummaries([])).resolves.toEqual([])
    await expect(
      userItems.getRatingSummaries([new Types.ObjectId()]),
    ).resolves.toEqual([])
  })

  it("создаёт метрики с defaults, сохраняет остальные поля и исходные данные при повторном пересчёте", async () => {
    const rated = await createItem()
    const unrated = await createItem()
    await createRating(rated._id, 10)
    const existing = await metrics.write.create({
      item: rated._id,
      ratingAverage: 2,
      ratingsCount: 20,
      completedAttemptsCount: 7,
      recommendationsCount: 11,
      favoritesCount: 3,
      ratingDistribution: { two: 20 },
      statusCounts: { planned: 2, completed: 7 },
    })
    const before = existing.toObject()
    const { connection } = getTestDatabase()
    const itemsBefore = await connection.collection("Item").find().toArray()
    const userItemsBefore = await connection
      .collection("UserItem")
      .find()
      .toArray()

    for (let attempt = 0; attempt < 2; attempt += 1) {
      await expect(handler.handle(null, context)).resolves.toEqual({
        processedItems: 2,
      })
      const stored = await metrics.read.findOne({ item: rated._id })
      expect(stored?.toObject()).toEqual({
        ...before,
        ratingAverage: 10,
        ratingsCount: 1,
        updatedAt: expect.any(Date),
      })
      const created = await metrics.read.findOne({ item: unrated._id })
      expect(created).toMatchObject({
        ratingAverage: null,
        ratingsCount: 0,
        completedAttemptsCount: 0,
        recommendationsCount: 0,
        favoritesCount: 0,
        ratingDistribution: {
          one: 0,
          two: 0,
          three: 0,
          four: 0,
          five: 0,
          six: 0,
          seven: 0,
          eight: 0,
          nine: 0,
          ten: 0,
        },
        statusCounts: {
          planned: 0,
          inProgress: 0,
          onHold: 0,
          completed: 0,
          dropped: 0,
        },
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      })
      await expect(created?.validate()).resolves.toBeUndefined()
    }

    expect(await connection.collection("ItemMetric").countDocuments()).toBe(2)
    expect(await connection.collection("Item").find().toArray()).toEqual(
      itemsBefore,
    )
    expect(await connection.collection("UserItem").find().toArray()).toEqual(
      userItemsBefore,
    )
  })

  it("учитывает изменение и очистку оценки и сбрасывает метрику после удаления последней оценки", async () => {
    const item = await createItem()
    const first = await createRating(item._id, 8)
    const second = await createRating(item._id, 10)
    await handler.handle(null, context)
    expect(await metrics.read.findOne({ item: item._id })).toMatchObject({
      ratingAverage: 9,
      ratingsCount: 2,
    })
    await userItems.write.updateById(String(first._id), { $set: { rating: 1 } })
    await handler.handle(null, context)
    expect(await metrics.read.findOne({ item: item._id })).toMatchObject({
      ratingAverage: 5.5,
      ratingsCount: 2,
    })
    await userItems.write.updateById(String(first._id), {
      $set: { rating: null },
    })
    await handler.handle(null, context)
    expect(await metrics.read.findOne({ item: item._id })).toMatchObject({
      ratingAverage: 10,
      ratingsCount: 1,
    })
    await userItems.write.deleteById(String(second._id))
    await handler.handle(null, context)
    expect(await metrics.read.findOne({ item: item._id })).toMatchObject({
      ratingAverage: null,
      ratingsCount: 0,
    })
  })

  it("пересчитывает soft-deleted Items и не создаёт метрики для отсутствующих Items", async () => {
    const item = await createItem()
    await items.write.updateById(String(item._id), {
      $set: { deletedAt: new Date() },
    })
    await createRating(item._id, 7)
    const missingId = new Types.ObjectId()
    await createRating(missingId, 10)

    await expect(handler.handle(null, context)).resolves.toEqual({
      processedItems: 1,
    })
    expect(await metrics.read.findOne({ item: item._id })).toMatchObject({
      ratingAverage: 7,
      ratingsCount: 1,
    })
    await expect(metrics.read.findOne({ item: missingId })).resolves.toBeNull()
  })

  it("обрабатывает 501 Item без пропусков и сохраняет оценки по обе стороны границы порций", async () => {
    const catalogue = await items.bulk.createMany(
      Array.from({ length: 501 }, (_, index) => ({
        type: EItemType.MOVIE,
        title: { ru: null, en: `Movie ${index}` },
      })),
    )
    const sorted = [...catalogue].sort((first, second) => {
      return String(first._id).localeCompare(String(second._id))
    })
    await createRating(sorted[499]._id, 1)
    await createRating(sorted[500]._id, 10)

    await expect(handler.handle(null, context)).resolves.toEqual({
      processedItems: 501,
    })
    expect(
      await getTestDatabase()
        .connection.collection("ItemMetric")
        .countDocuments(),
    ).toBe(501)
    expect(await metrics.read.findOne({ item: sorted[499]._id })).toMatchObject(
      {
        ratingAverage: 1,
        ratingsCount: 1,
      },
    )
    expect(await metrics.read.findOne({ item: sorted[500]._id })).toMatchObject(
      {
        ratingAverage: 10,
        ratingsCount: 1,
      },
    )
  })

  it("завершает пустой каталог без создания метрик", async () => {
    await expect(handler.handle(null, context)).resolves.toEqual({
      processedItems: 0,
    })
    expect(
      await getTestDatabase()
        .connection.collection("ItemMetric")
        .countDocuments(),
    ).toBe(0)
  })

  it("регистрирует обработчик, выполняет пересчёт через очередь и дедуплицирует ожидающие задачи", async () => {
    const item = await createItem()
    await createRating(item._id, 8)
    expect(
      moduleRef.get(JobRegistryService).get(RECALCULATE_ITEM_RATINGS_JOB.name),
    ).toEqual({
      definition: RECALCULATE_ITEM_RATINGS_JOB,
      handler,
    })
    const ratingCrons = [
      ...moduleRef.get(SchedulerRegistry).getCronJobs().values(),
    ].filter((cron) => cron.cronTime.source === "0 0 */5 * * *")
    expect(ratingCrons).toHaveLength(1)
    expect(ratingCrons[0].cronTime.timeZone).toBe("Europe/Moscow")
    const id = await scheduler.enqueueRecalculation()
    await expect(scheduler.enqueueRecalculation()).resolves.toBe(id)
    expect((await queue.getJob(id))?.data).toEqual({
      name: "item.recalculateRatings",
      version: 1,
      payload: null,
      retryDelays: [5000, 30000, 120000],
      cancellationState: "none",
    })
    await queue.resume()
    await waitForCompletion(id)
    expect((await queue.getJob(id))?.returnvalue).toEqual({ processedItems: 1 })
    expect(await metrics.read.findOne({ item: item._id })).toMatchObject({
      ratingAverage: 8,
      ratingsCount: 1,
    })
    const nextId = await scheduler.enqueueRecalculation()
    expect(nextId).not.toBe(id)
    await waitForCompletion(nextId)
    expect(
      await getTestDatabase()
        .connection.collection("ItemMetric")
        .countDocuments(),
    ).toBe(1)
  })

  it("повторяет пересчёт после временной ошибки записи без дублирования метрик", async () => {
    const item = await createItem()
    await createRating(item._id, 9)
    jest
      .spyOn(metrics.bulk, "bulkWrite")
      .mockRejectedValueOnce(new Error("Temporary write failure"))
    const id = await scheduler.enqueueRecalculation()
    await queue.resume()
    await waitForCompletion(id)

    expect((await queue.getJob(id))?.attemptsMade).toBe(2)
    expect(await metrics.read.findOne({ item: item._id })).toMatchObject({
      ratingAverage: 9,
      ratingsCount: 1,
    })
    expect(
      await getTestDatabase()
        .connection.collection("ItemMetric")
        .countDocuments(),
    ).toBe(1)
  })
})
