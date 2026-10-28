import { setTimeout } from "node:timers/promises"
import { EventEmitter, once } from "node:events"
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals"
import { getQueueToken } from "@nestjs/bullmq"
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
import { ItemRatingsRecalculationService } from "../services/itemRatingsRecalculation.service"
import { RECALCULATE_ITEM_RATINGS_JOB } from "../static/RECALCULATE_ITEM_RATINGS_JOB"

describe("ItemRatingsModule", () => {
  let moduleRef: TestingModule
  let queue: Queue
  let jobs: JobService
  let handler: RecalculateItemRatingsJobHandler
  let recalculation: ItemRatingsRecalculationService
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
    recalculation = moduleRef.get(ItemRatingsRecalculationService)
    items = moduleRef.get(ItemRepository)
    userItems = moduleRef.get(UserItemRepository)
    metrics = moduleRef.get(ItemMetricRepository)
    await queue.pause()
    await moduleRef.init()
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
    await handler.handle(String(first._id), context)

    const firstMetric = await metrics.read.findOne({ item: first._id })
    expect(firstMetric?.ratingAverage).toBeCloseTo(19 / 3, 12)
    expect(firstMetric?.ratingsCount).toBe(3)
    await expect(metrics.read.findOne({ item: second._id })).resolves.toBeNull()
    await handler.handle(String(second._id), context)
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
      await expect(handler.handle(String(rated._id), context)).resolves.toEqual(
        {
          processedItems: 1,
        },
      )
      await handler.handle(String(unrated._id), context)
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
    await handler.handle(String(item._id), context)
    expect(await metrics.read.findOne({ item: item._id })).toMatchObject({
      ratingAverage: 9,
      ratingsCount: 2,
    })
    await userItems.write.updateById(String(first._id), { $set: { rating: 1 } })
    await handler.handle(String(item._id), context)
    expect(await metrics.read.findOne({ item: item._id })).toMatchObject({
      ratingAverage: 5.5,
      ratingsCount: 2,
    })
    await userItems.write.updateById(String(first._id), {
      $set: { rating: null },
    })
    await handler.handle(String(item._id), context)
    expect(await metrics.read.findOne({ item: item._id })).toMatchObject({
      ratingAverage: 10,
      ratingsCount: 1,
    })
    await userItems.write.deleteById(String(second._id))
    await handler.handle(String(item._id), context)
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

    await expect(handler.handle(String(item._id), context)).resolves.toEqual({
      processedItems: 1,
    })
    expect(await metrics.read.findOne({ item: item._id })).toMatchObject({
      ratingAverage: 7,
      ratingsCount: 1,
    })
    await expect(handler.handle(String(missingId), context)).resolves.toEqual({
      processedItems: 0,
    })
    await expect(metrics.read.findOne({ item: missingId })).resolves.toBeNull()
  })

  it("не создаёт метрику отсутствующего Item в пустом каталоге", async () => {
    await expect(
      handler.handle(String(new Types.ObjectId()), context),
    ).resolves.toEqual({
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
    const id = await recalculation.enqueue(item._id)
    await expect(recalculation.enqueue(item._id)).resolves.toBe(id)
    expect((await queue.getJob(id))?.data).toEqual({
      name: "item.recalculateRatings",
      version: 2,
      payload: String(item._id),
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
    const nextId = await recalculation.enqueue(item._id)
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
      .spyOn(metrics.write, "updateByFilter")
      .mockRejectedValueOnce(new Error("Temporary write failure"))
    const id = await recalculation.enqueue(item._id)
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

  it("ставит задачи разных Item независимо друг от друга", async () => {
    const first = await createItem()
    const second = await createItem()
    await createRating(first._id, 2)
    await createRating(second._id, 10)

    const firstId = await recalculation.enqueue(first._id)
    const secondId = await recalculation.enqueue(second._id)
    expect(secondId).not.toBe(firstId)
    await queue.resume()
    await Promise.all([waitForCompletion(firstId), waitForCompletion(secondId)])

    expect(await metrics.read.findOne({ item: first._id })).toMatchObject({
      ratingAverage: 2,
      ratingsCount: 1,
    })
    expect(await metrics.read.findOne({ item: second._id })).toMatchObject({
      ratingAverage: 10,
      ratingsCount: 1,
    })
  })

  it("объединяет события во время расчёта в один повторный запуск с актуальной оценкой", async () => {
    const item = await createItem()
    const rating = await createRating(item._id, 8)
    const gate = new EventEmitter()
    const started = once(gate, "started", { signal: AbortSignal.timeout(5000) })
    const resume = once(gate, "resume")
    const getRatingSummaries = userItems.getRatingSummaries.bind(userItems)
    const aggregate = jest
      .spyOn(userItems, "getRatingSummaries")
      .mockImplementationOnce(async (ids) => {
        const summaries = await getRatingSummaries(ids)
        gate.emit("started")
        await resume

        return summaries
      })

    try {
      const id = await recalculation.enqueue(item._id)
      await queue.resume()
      await started
      await userItems.write.updateById(String(rating._id), {
        $set: { rating: 10 },
      })
      await recalculation.enqueue(item._id)
      await userItems.write.updateById(String(rating._id), {
        $set: { rating: 1 },
      })
      await recalculation.enqueue(item._id)
      gate.emit("resume")
      await waitForCompletion(id)

      const deadline = Date.now() + 5000

      while (Date.now() < deadline) {
        const completed = await queue.getJobs(["completed"])

        if (completed.length === 2) {
          break
        }

        await setTimeout(20)
      }

      expect(await queue.getJobs(["completed"])).toHaveLength(2)
      expect(aggregate).toHaveBeenCalledTimes(2)
      expect(await metrics.read.findOne({ item: item._id })).toMatchObject({
        ratingAverage: 1,
        ratingsCount: 1,
      })
    } finally {
      gate.emit("resume")
    }
  })
})
