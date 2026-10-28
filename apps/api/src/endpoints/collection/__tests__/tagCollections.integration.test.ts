import { EventEmitter, once } from "node:events"
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
import { getConnectionToken } from "@nestjs/mongoose"
import { Test, type TestingModule } from "@nestjs/testing"
import type { Queue } from "bullmq"
import { mongo, Types } from "mongoose"
import type { Connection } from "mongoose"

import { TagModule } from "@entities/tag/tag.module"
import { TagRepository } from "@entities/tag/services/tag.repository"
import { ItemModule } from "@entities/item/item.module"
import { ItemRepository } from "@entities/item/services/item.repository"
import { EItemType } from "@entities/item/schemas/EItemType"
import { ItemTagModule } from "@entities/itemTag/itemTag.module"
import { ItemTagRepository } from "@entities/itemTag/services/itemTag.repository"
import { CollectionModule } from "@entities/collection/collection.module"
import { CollectionRepository } from "@entities/collection/services/collection.repository"
import { ECollectionType } from "@entities/collection/schemas/ECollectionType"
import { ECollectionBlockType } from "@entities/collection/schemas/ECollectionBlockType"
import { CollectionItemModule } from "@entities/collectionItem/collectionItem.module"
import { CollectionItemRepository } from "@entities/collectionItem/services/collectionItem.repository"
import { infrastructureConfiguration } from "@infrastructure/config/config.module"
import { DatabaseModule } from "@infrastructure/database/database.module"
import { MongoTransactionService } from "@infrastructure/database/services/mongoTransaction.service"
import { JobsModule } from "@infrastructure/jobs/jobs.module"
import { JobService } from "@infrastructure/jobs/services/job.service"
import { JOBS_QUEUE_NAME } from "@infrastructure/jobs/static/JOBS_QUEUE_NAME"
import type { IJobContext } from "@infrastructure/jobs/types/IJobContext"
import { LoggerService } from "@infrastructure/logger/services/logger.service"
import { createTestConfiguration } from "@test/functions/createTestConfiguration"
import { getTestDatabase } from "@test/setup/setupDatabase"
import { getTestRedis } from "@test/setup/setupRedis"
import { TagCollectionsInitializationService } from "../services/tagCollectionsInitialization.service"
import { TagCollectionsSynchronizationService } from "../services/tagCollectionsSynchronization.service"
import { SynchronizeTagCollectionsJobHandler } from "../handlers/synchronizeTagCollectionsJob.handler"
import dictionary from "../../../../import/tags/tags.json"

describe("Tag collections MongoDB/BullMQ", () => {
  let moduleRef: TestingModule | undefined
  let queue: Queue
  let tags: TagRepository
  let items: ItemRepository
  let assignments: ItemTagRepository
  let collections: CollectionRepository
  let memberships: CollectionItemRepository
  let transactions: MongoTransactionService
  let jobs: JobService
  let synchronization: TagCollectionsSynchronizationService
  let handler: SynchronizeTagCollectionsJobHandler
  const context = {
    id: "tag-integration",
    attempt: 1,
    throwIfCancelled: async () => {},
    updateProgress: async () => {},
  } satisfies IJobContext

  const processJobs = async () => {
    await queue.resume()
    const deadline = Date.now() + 20_000
    while (Date.now() < deadline) {
      const failed = await queue.getJobs(["failed"])
      if (failed.length > 0) {
        throw new Error(failed.map((job) => job.failedReason).join("; "))
      }
      if ((await queue.getJobs(["wait", "active", "delayed"])).length === 0) {
        return
      }
      await setTimeout(20)
    }
    throw new Error("Очередь теговых коллекций не завершилась за 20 секунд")
  }

  const createScenario = async () => {
    const parent = await tags.write.create({
      key: "parentTag",
      name: { ru: "Родитель", en: null },
    })
    const child = await tags.write.create({
      key: "childTag",
      name: { ru: "Потомок", en: null },
      parents: [parent._id],
    })
    const other = await tags.write.create({
      key: "otherTag",
      name: { ru: "Другой", en: null },
    })
    const first = await items.write.create({
      type: EItemType.MOVIE,
      title: { ru: "Первый", en: null },
    })
    const second = await items.write.create({
      type: EItemType.MOVIE,
      title: { ru: "Второй", en: null },
    })
    for (const tag of [parent, child, other]) {
      await collections.ensureForTag(tag._id, tag.name)
    }
    const childCollection = await collections.read.findOne({
      tag: child._id,
      author: null,
    })
    const otherCollection = await collections.read.findOne({
      tag: other._id,
      author: null,
    })
    if (childCollection === null || otherCollection === null) {
      throw new Error("Не созданы коллекции тестовых тегов")
    }
    return {
      parent,
      child,
      other,
      first,
      second,
      childCollection,
      otherCollection,
    }
  }

  beforeEach(async () => {
    for (const name of [
      "Tag",
      "Item",
      "ItemTag",
      "Collection",
      "CollectionItem",
    ]) {
      await getTestDatabase().connection.collection(name).deleteMany({})
    }
    moduleRef = await Test.createTestingModule({
      imports: [
        DatabaseModule,
        TagModule,
        ItemModule,
        ItemTagModule,
        CollectionModule,
        CollectionItemModule,
        JobsModule,
      ],
      providers: [
        TagCollectionsSynchronizationService,
        SynchronizeTagCollectionsJobHandler,
      ],
    })
      .overrideProvider(infrastructureConfiguration.KEY)
      .useValue(
        createTestConfiguration(getTestDatabase().uri, getTestRedis().url),
      )
      .overrideProvider(LoggerService)
      .useValue({ info: jest.fn(), error: jest.fn() })
      .compile()
    queue = moduleRef.get<Queue>(getQueueToken(JOBS_QUEUE_NAME))
    tags = moduleRef.get(TagRepository)
    items = moduleRef.get(ItemRepository)
    assignments = moduleRef.get(ItemTagRepository)
    collections = moduleRef.get(CollectionRepository)
    memberships = moduleRef.get(CollectionItemRepository)
    transactions = moduleRef.get(MongoTransactionService)
    jobs = moduleRef.get(JobService)
    synchronization = moduleRef.get(TagCollectionsSynchronizationService)
    handler = moduleRef.get(SynchronizeTagCollectionsJobHandler)
    await queue.pause()
    await moduleRef.init()
    await Promise.all([
      tags.initialize(),
      collections.initialize(),
      ...["Item", "ItemTag", "CollectionItem"].map(async (name) => {
        await moduleRef
          ?.get<Connection>(getConnectionToken())
          .model(name)
          .init()
      }),
    ])
  })

  afterEach(async () => {
    await moduleRef?.close()
    moduleRef = undefined
  })

  it("создаёт по одной коллекции для всех тегов при повторном и конкурентном запуске без наполнения историческими ItemTag", async () => {
    const existing = await tags.write.create({
      key: "fantasy",
      name: { ru: "Сохранённое имя", en: null },
    })
    const extra = await tags.write.create({
      key: "customTag",
      name: { ru: "Дополнительный", en: null },
    })
    await getTestDatabase().connection.collection("ItemTag").insertOne({
      item: new Types.ObjectId(),
      tag: existing._id,
      relevanceScore: 0.7,
    })
    const initialize = new TagCollectionsInitializationService(
      tags,
      collections,
    )
    await Promise.all([
      initialize.onModuleInit(),
      new TagCollectionsInitializationService(tags, collections).onModuleInit(),
    ])
    const tagCount =
      dictionary.reduce((count, group) => count + group.tags.length, 0) + 1
    expect(await tags.read.findMany({})).toHaveLength(tagCount)
    const firstCollections = await collections.read.findMany({
      type: ECollectionType.TAG,
      author: null,
    })
    expect(firstCollections).toHaveLength(tagCount)
    expect(
      new Set(firstCollections.map((collection) => String(collection.tag)))
        .size,
    ).toBe(tagCount)
    for (const collection of firstCollections) {
      expect(collection.blocks).toHaveLength(1)
      expect(collection.blocks[0]).toMatchObject({
        type: "group",
        title: null,
        content: null,
      })
    }
    expect((await tags.read.findOne({ key: "fantasy" }))?.name.ru).toBe(
      "Сохранённое имя",
    )
    expect(await collections.read.findOne({ tag: extra._id })).not.toBeNull()
    const urban = await tags.read.findOne({ key: "urbanFantasy" })
    expect(urban?.parents.map(String)).toEqual([String(existing._id)])
    expect(await memberships.read.findMany({})).toEqual([])
    await initialize.onModuleInit()
    expect(
      (await collections.read.findMany({}))
        .map((collection) => String(collection._id))
        .sort(),
    ).toEqual(
      firstCollections.map((collection) => String(collection._id)).sort(),
    )
    expect(await queue.getJobs(["wait", "active", "completed"])).toEqual([])
  }, 120_000)

  it("создаёт только прямое членство, обновляет значимость и сохраняет позиции, заметки и ручные коллекции", async () => {
    const { first, child, childCollection } = await createScenario()
    const manual = await collections.write.create({
      title: { ru: "Франшиза", en: null },
      type: ECollectionType.FRANCHISE,
      blocks: [{ type: ECollectionBlockType.GROUP }],
    })
    await memberships.write.create({
      collectionId: manual._id,
      item: first._id,
      groupId: manual.blocks[0].id,
      position: 8,
      note: "Ручной состав",
    })
    const assignment = await assignments.write.create({
      item: first._id,
      tag: child._id,
      relevanceScore: 0.01,
    })
    await processJobs()
    const automatic = await memberships.read.findOne({
      collectionId: childCollection._id,
      item: first._id,
    })
    expect(automatic?.relevanceScore).toBe(0.01)
    expect(await memberships.read.findMany({ item: first._id })).toHaveLength(2)
    await memberships.write.updateByFilter(
      { collectionId: childCollection._id, item: first._id },
      { $set: { position: 17, note: "Сохранить" } },
    )
    await assignments.write.updateById(String(assignment._id), {
      $set: { relevanceScore: 1 },
    })
    await synchronization.enqueue(first._id)
    await processJobs()
    expect(
      await memberships.read.findOne({
        collectionId: childCollection._id,
        item: first._id,
      }),
    ).toMatchObject({
      _id: automatic?._id,
      relevanceScore: 1,
      position: 17,
      note: "Сохранить",
    })
    expect(
      await memberships.read.findOne({
        collectionId: manual._id,
        item: first._id,
      }),
    ).toMatchObject({
      position: 8,
      note: "Ручной состав",
      relevanceScore: null,
    })
    expect(await memberships.read.findMany({ item: first._id })).toHaveLength(2)
  })

  it("удаляет старое членство при замене тега и переносе назначения на другое произведение", async () => {
    const { first, second, child, other, childCollection, otherCollection } =
      await createScenario()
    const assignment = await assignments.write.create({
      item: first._id,
      tag: child._id,
      relevanceScore: 0.3,
    })
    await processJobs()
    await assignments.write.updateByFilter(
      { _id: assignment._id },
      { $set: { item: second._id, tag: other._id, relevanceScore: 0.8 } },
    )
    await processJobs()
    expect(
      await memberships.read.findMany({ collectionId: childCollection._id }),
    ).toEqual([])
    const result = await memberships.read.findMany({})
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      collectionId: otherCollection._id,
      item: second._id,
      relevanceScore: 0.8,
    })
    await synchronization.enqueue(first._id)
    await processJobs()
    expect(await memberships.read.findMany({ item: first._id })).toEqual([])
  })

  it.each([
    "deleteById",
    "deleteByFilter",
    "deleteMany",
    "bulkDelete",
  ] as const)("удаляет членство после операции %s", async (operation) => {
    const { first, child } = await createScenario()
    const assignment = await assignments.write.create({
      item: first._id,
      tag: child._id,
      relevanceScore: 0.5,
    })
    await processJobs()
    if (operation === "deleteById") {
      await assignments.write.deleteById(String(assignment._id))
    } else if (operation === "deleteByFilter") {
      await assignments.write.deleteByFilter({ _id: assignment._id })
    } else if (operation === "deleteMany") {
      await assignments.bulk.deleteMany({ item: first._id })
    } else {
      await assignments.bulk.bulkWrite([
        { deleteOne: { filter: { _id: assignment._id } } },
      ])
    }
    await processJobs()
    expect(await memberships.read.findMany({ item: first._id })).toEqual([])
  })

  it.each(["createMany", "rawResult", "bulkInsert", "upsert"] as const)(
    "публикует назначения, созданные через %s",
    async (operation) => {
      const { first, child, childCollection } = await createScenario()
      const payload = { item: first._id, tag: child._id, relevanceScore: 0.4 }
      if (operation === "createMany") {
        await assignments.bulk.createMany([payload])
      } else if (operation === "rawResult") {
        await assignments.bulk.createMany([payload], { rawResult: true })
      } else if (operation === "bulkInsert") {
        await assignments.bulk.bulkWrite([{ insertOne: { document: payload } }])
      } else {
        await assignments.write.updateByFilter(
          { item: first._id, tag: child._id },
          { $set: payload },
          { upsert: true },
        )
      }
      await processJobs()
      expect(
        await memberships.read.findOne({
          collectionId: childCollection._id,
          item: first._id,
        }),
      ).toMatchObject({ relevanceScore: 0.4 })
    },
  )

  it.each(["updateMany", "bulkUpdate", "replaceOne"] as const)(
    "учитывает оба произведения после %s",
    async (operation) => {
      const { first, second, child, other, otherCollection } =
        await createScenario()
      const record = await assignments.write.create({
        item: first._id,
        tag: child._id,
        relevanceScore: 0.2,
      })
      await processJobs()
      const replacement = {
        item: second._id,
        tag: other._id,
        relevanceScore: 0.9,
      }
      if (operation === "updateMany") {
        await assignments.bulk.updateMany(
          { _id: record._id },
          { $set: replacement },
        )
      } else if (operation === "bulkUpdate") {
        await assignments.bulk.bulkWrite([
          {
            updateMany: {
              filter: { _id: record._id },
              update: { $set: replacement },
            },
          },
        ])
      } else {
        await assignments.bulk.bulkWrite([
          { replaceOne: { filter: { _id: record._id }, replacement } },
        ])
      }
      await processJobs()
      expect(await memberships.read.findMany({ item: first._id })).toEqual([])
      expect(
        await memberships.read.findOne({
          collectionId: otherCollection._id,
          item: second._id,
        }),
      ).toMatchObject({ relevanceScore: 0.9 })
    },
  )

  it("публикует только после реального commit и ничего не публикует после rollback создания, изменения и удаления", async () => {
    const { first, second, child } = await createScenario()
    const publish = jest.spyOn(jobs, "add")
    const record = await transactions.run(async (session) => {
      const created = await assignments.write.create(
        { item: first._id, tag: child._id, relevanceScore: 0.3 },
        { session },
      )
      expect(publish).not.toHaveBeenCalled()
      return created
    })
    expect(publish).toHaveBeenCalledTimes(1)
    await processJobs()
    publish.mockClear()
    await expect(
      transactions.run(async (session) => {
        await assignments.write.updateById(
          String(record._id),
          { $set: { relevanceScore: 0.9 } },
          { session },
        )
        await assignments.write.deleteById(String(record._id), { session })
        await assignments.write.create(
          { item: second._id, tag: child._id, relevanceScore: 0.6 },
          { session },
        )
        expect(publish).not.toHaveBeenCalled()
        throw new Error("rollback")
      }),
    ).rejects.toThrow("rollback")
    expect(publish).not.toHaveBeenCalled()
    expect(await assignments.read.findById(String(record._id))).toMatchObject({
      relevanceScore: 0.3,
    })
    expect(await assignments.read.findMany({ item: second._id })).toEqual([])
    expect(await memberships.read.findMany({ item: first._id })).toHaveLength(1)
  })

  it.each([false, true])(
    "сообщает об ошибке очереди после сохранения MongoDB, транзакция=%s",
    async (isTransactional) => {
      const { first, child } = await createScenario()
      jest
        .spyOn(jobs, "add")
        .mockRejectedValueOnce(new Error("Redis unavailable"))
      const payload = { item: first._id, tag: child._id, relevanceScore: 0.5 }
      const write = isTransactional
        ? transactions.run(async (session) =>
            assignments.write.create(payload, { session }),
          )
        : assignments.write.create(payload)
      await expect(write).rejects.toThrow("Redis unavailable")
      expect(
        await assignments.read.findOne({ item: first._id, tag: child._id }),
      ).not.toBeNull()
      expect(await memberships.read.findMany({})).toEqual([])
    },
  )

  it("не публикует события откатившегося пакета внутри транзакции", async () => {
    const { first, second, child } = await createScenario()
    const publish = jest.spyOn(jobs, "add")
    const payload = { item: first._id, tag: child._id, relevanceScore: 0.4 }

    await expect(
      transactions.run(async (session) => {
        await assignments.bulk.createMany(
          [payload, payload, { ...payload, item: second._id }],
          { session, ordered: false },
        )
      }),
    ).rejects.toThrow()

    expect(publish).not.toHaveBeenCalled()
    expect(await assignments.read.findMany({})).toEqual([])
    expect(await memberships.read.findMany({})).toEqual([])
  })

  it("после повтора Mongo-транзакции публикует только последнюю попытку", async () => {
    const { first, second, child } = await createScenario()
    const publish = jest.spyOn(jobs, "add")
    let attempt = 0

    await transactions.run(async (session) => {
      attempt += 1
      await assignments.write.create(
        {
          item: attempt === 1 ? first._id : second._id,
          tag: child._id,
          relevanceScore: 0.6,
        },
        { session },
      )
      expect(publish).not.toHaveBeenCalled()
      if (attempt === 1) {
        const error = new mongo.MongoServerError({
          message: "Retry transaction",
        })
        error.addErrorLabel("TransientTransactionError")
        throw error
      }
    })

    expect(attempt).toBe(2)
    expect(publish).toHaveBeenCalledTimes(1)
    expect(publish.mock.calls[0][1]).toBe(String(second._id))
    await processJobs()
    expect(await memberships.read.findMany({ item: first._id })).toEqual([])
    expect(await memberships.read.findMany({ item: second._id })).toHaveLength(
      1,
    )
  })

  it("отклоняет неуправляемую активную session до записи в MongoDB", async () => {
    const { first, child } = await createScenario()
    if (moduleRef === undefined) {
      throw new Error("Тестовый модуль не создан")
    }
    const session = await moduleRef
      .get<Connection>(getConnectionToken())
      .startSession()
    const publish = jest.spyOn(jobs, "add")

    try {
      session.startTransaction()
      await expect(
        assignments.write.create(
          { item: first._id, tag: child._id, relevanceScore: 0.5 },
          { session },
        ),
      ).rejects.toThrow("MongoTransactionService.run")
      expect(publish).not.toHaveBeenCalled()
      expect(await assignments.read.findMany({})).toEqual([])
    } finally {
      if (session.inTransaction()) {
        await session.abortTransaction()
      }
      await session.endSession()
    }
  })

  it.each([0, -0.1, 1.1, Number.NaN, Number.POSITIVE_INFINITY])(
    "отклоняет значимость %s без удаления связи и публикации события",
    async (score) => {
      const { first, child } = await createScenario()
      const record = await assignments.write.create({
        item: first._id,
        tag: child._id,
        relevanceScore: 0.5,
      })
      await processJobs()
      const publish = jest.spyOn(jobs, "add")
      await expect(
        assignments.write.updateById(String(record._id), {
          $set: { relevanceScore: score },
        }),
      ).rejects.toThrow()
      expect(publish).not.toHaveBeenCalled()
      expect(await assignments.read.findById(String(record._id))).toMatchObject(
        { relevanceScore: 0.5 },
      )
      expect(await memberships.read.findMany({ item: first._id })).toHaveLength(
        1,
      )
    },
  )

  it("сверяет успешные вставки после частичного отказа неупорядоченного пакета", async () => {
    const { first, second, child } = await createScenario()
    const payload = { item: first._id, tag: child._id, relevanceScore: 0.4 }
    await expect(
      assignments.bulk.createMany(
        [payload, payload, { ...payload, item: second._id }],
        { ordered: false },
      ),
    ).rejects.toThrow()
    await processJobs()
    const result = await memberships.read.findMany({})
    expect(result).toHaveLength(2)
    expect(result.map((record) => String(record.item)).sort()).toEqual(
      [String(first._id), String(second._id)].sort(),
    )
  })

  it("повторяет задание после временной ошибки записи без дублирования состава", async () => {
    const { first, child } = await createScenario()
    jest
      .spyOn(memberships.write, "updateByFilter")
      .mockRejectedValueOnce(new Error("Temporary write failure"))
    await assignments.write.create({
      item: first._id,
      tag: child._id,
      relevanceScore: 0.7,
    })
    await processJobs()
    const completed = await queue.getJobs(["completed"])
    expect(completed).toHaveLength(1)
    expect(completed[0].attemptsMade).toBe(2)
    expect(await memberships.read.findMany({ item: first._id })).toHaveLength(1)
  })

  it("объединяет события активного задания в один последовательный повтор и заменяет устаревший результат", async () => {
    const { first, child } = await createScenario()
    const gate = new EventEmitter()
    const started = once(gate, "started", {
      signal: AbortSignal.timeout(10_000),
    })
    const resume = once(gate, "resume")
    const write = memberships.write.updateByFilter.bind(memberships.write)
    jest
      .spyOn(memberships.write, "updateByFilter")
      .mockImplementationOnce(async (...args) => {
        gate.emit("started")
        await resume
        return await write(...args)
      })
    const original = handler.handle.bind(handler)
    let active = 0
    let maxActive = 0
    const handle = jest
      .spyOn(handler, "handle")
      .mockImplementation(async (...args) => {
        active += 1
        maxActive = Math.max(maxActive, active)
        try {
          return await original(...args)
        } finally {
          active -= 1
        }
      })
    try {
      const record = await assignments.write.create({
        item: first._id,
        tag: child._id,
        relevanceScore: 0.2,
      })
      await queue.resume()
      await started
      await assignments.write.updateById(String(record._id), {
        $set: { relevanceScore: 0.8 },
      })
      await assignments.write.updateById(String(record._id), {
        $set: { relevanceScore: 1 },
      })
      gate.emit("resume")
      await processJobs()
      expect(handle).toHaveBeenCalledTimes(2)
      expect(maxActive).toBe(1)
      expect(await memberships.read.findOne({ item: first._id })).toMatchObject(
        { relevanceScore: 1 },
      )
      expect(await memberships.read.findMany({ item: first._id })).toHaveLength(
        1,
      )
    } finally {
      gate.emit("resume")
    }
  })

  it("повторно сверяет актуальное состояние при запоздавшем событии после удаления", async () => {
    const { first, child } = await createScenario()
    const record = await assignments.write.create({
      item: first._id,
      tag: child._id,
      relevanceScore: 0.4,
    })
    await processJobs()
    await assignments.write.deleteById(String(record._id))
    await processJobs()
    await synchronization.enqueue(first._id)
    await processJobs()
    expect(await memberships.read.findMany({ item: first._id })).toEqual([])
    await expect(handler.handle(String(first._id), context)).resolves.toEqual({
      processedItems: 1,
    })
  })
})
