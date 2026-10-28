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
import { getConnectionToken, getModelToken } from "@nestjs/mongoose"
import { Test, type TestingModule } from "@nestjs/testing"
import type { Queue } from "bullmq"
import { Types, type HydratedDocument, type Model } from "mongoose"

import { EItemType } from "@entities/item/schemas/EItemType"
import { ItemTagRepository } from "@entities/itemTag/services/itemTag.repository"
import { ETagGroup } from "@entities/tag/schemas/ETagGroup"
import { EUnit } from "@entities/shared/schemas/EUnit"
import { UserRepository } from "@entities/user/services/user.repository"
import { EUserItemStatus } from "@entities/userItem/schemas/EUserItemStatus"
import { UserItemRepository } from "@entities/userItem/services/userItem.repository"
import { infrastructureConfiguration } from "@infrastructure/config/config.module"
import { DatabaseModule } from "@infrastructure/database/database.module"
import { JOBS_QUEUE_NAME } from "@infrastructure/jobs/static/JOBS_QUEUE_NAME"
import { LoggerService } from "@infrastructure/logger/services/logger.service"
import type { IJobContext } from "@infrastructure/jobs/types/IJobContext"
import { createTestConfiguration } from "@test/functions/createTestConfiguration"
import { createTestDatabase } from "@test/functions/createTestDatabase"
import { createTestRedis } from "@test/functions/createTestRedis"

import { UserTasteProfile } from "../schemas/userTasteProfile.schema"
import { UserTasteProfileRepository } from "../services/userTasteProfile.repository"
import { UserTasteProfileRecalculationService } from "../services/userTasteProfileRecalculation.service"
import { RECALCULATE_USER_TASTE_PROFILE_JOB } from "../static/RECALCULATE_USER_TASTE_PROFILE_JOB"
import { UserTasteProfileModule } from "../userTasteProfile.module"
import type { TCalculatedTasteTagPreference } from "../types/TCalculatedTasteTagPreference"

describe("UserTasteProfileRecalculation MongoDB и Redis", () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>> | undefined
  let redis: Awaited<ReturnType<typeof createTestRedis>> | undefined
  let module: TestingModule | undefined
  let service: UserTasteProfileRecalculationService
  let repository: UserTasteProfileRepository
  let userItems: UserItemRepository
  let itemTags: ItemTagRepository
  let profiles: Model<HydratedDocument<UserTasteProfile>>
  let queue: Queue
  let user: Types.ObjectId
  let queuedItemId: Types.ObjectId
  let seededItemIds: Types.ObjectId[]
  const context = {
    id: "direct-test",
    attempt: 1,
    throwIfCancelled: async () => {},
    updateProgress: async () => {},
  } satisfies IJobContext

  beforeEach(async () => {
    queuedItemId = new Types.ObjectId()
    seededItemIds = []
    database = await createTestDatabase()
    redis = await createTestRedis()
    module = await Test.createTestingModule({
      imports: [DatabaseModule, UserTasteProfileModule],
    })
      .overrideProvider(infrastructureConfiguration.KEY)
      .useValue(createTestConfiguration(database.uri, redis.url))
      .overrideProvider(getConnectionToken())
      .useValue(database.connection)
      .overrideProvider(LoggerService)
      .useValue({ info: jest.fn(), error: jest.fn() })
      .compile()
    queue = module.get<Queue>(getQueueToken(JOBS_QUEUE_NAME))
    await queue.pause()
    await module.init()
    await Promise.all(
      Object.values(database.connection.models).map(async (model) => {
        await model.init()
      }),
    )
    service = module.get(UserTasteProfileRecalculationService)
    repository = module.get(UserTasteProfileRepository)
    itemTags = module.get(ItemTagRepository)
    userItems = module.get(UserItemRepository)
    profiles = module.get<Model<HydratedDocument<UserTasteProfile>>>(
      getModelToken(UserTasteProfile.name),
    )
    user = (await module.get(UserRepository).createNew()).user._id
  })

  afterEach(async () => {
    try {
      await module?.close()
    } finally {
      try {
        await database?.close()
      } finally {
        await redis?.close()
      }
    }
    module = undefined
    database = undefined
    redis = undefined
  })

  const seedTag = async (group: ETagGroup | null = ETagGroup.GENRE) => {
    const tag = new Types.ObjectId()
    await database?.connection
      .collection("Tag")
      .insertOne({ _id: tag, group, weightModifier: 99 })
    return tag
  }

  const seedReaction = async (props: {
    tag: Types.ObjectId
    rating?: number | null
    isFavorite?: boolean
    relevanceScore?: number
    status?: EUserItemStatus
    type?: EItemType
    deletedAt?: Date | null
  }) => {
    const item = new Types.ObjectId()
    queuedItemId = item
    seededItemIds.push(item)
    await database?.connection.collection("Item").insertOne({
      _id: item,
      type: props.type ?? EItemType.MOVIE,
      deletedAt: props.deletedAt ?? null,
    })
    await database?.connection.collection("ItemTag").insertOne({
      item,
      tag: props.tag,
      relevanceScore: props.relevanceScore ?? 1,
    })
    const record = await userItems.write.create({
      user,
      item,
      status: props.status ?? EUserItemStatus.PLANNED,
      rating: props.rating ?? null,
      isFavorite: props.isFavorite ?? false,
    })
    return record
  }

  const recalculateSeededItems = async () => {
    for (const itemId of seededItemIds.length > 0
      ? seededItemIds
      : [queuedItemId]) {
      await service.recalculate({ userId: user, itemId }, context)
    }
  }

  const replacePreferences = async (
    preferences: readonly TCalculatedTasteTagPreference[],
  ) => {
    return await repository.tryReplaceCalculatedPreferences({
      userId: user,
      tagIds: preferences.map((preference) => preference.tag),
      preferences,
      previousPreferences: await repository.readTagPreferences(user),
    })
  }

  const readPreferences = async () => {
    return (await profiles.findOne({ user }).lean())?.tagPreferences
  }

  const waitForCompletedCount = async (count: number) => {
    const deadline = Date.now() + 10_000
    while (Date.now() < deadline) {
      if (
        (await queue.getCompletedCount()) === count &&
        (await queue.getActiveCount()) === 0
      ) {
        return
      }
      await setTimeout(20)
    }
    throw new Error(
      `Не завершились ${count} задач: ${JSON.stringify(await queue.getJobCounts())}`,
    )
  }

  it("учитывает нейтральные оценки и blocked, исключает skipped, чужие записи и отсутствие реакции", async () => {
    const tag = await seedTag()
    await seedReaction({ tag, rating: 10, status: EUserItemStatus.BLOCKED })
    await seedReaction({ tag, rating: 6 })
    await seedReaction({ tag, rating: 1, status: EUserItemStatus.SKIPPED })
    for (const status of Object.values(EUserItemStatus)) {
      await seedReaction({ tag, status })
    }
    const foreign = await seedReaction({ tag, rating: 1 })
    await database?.connection
      .collection("UserItem")
      .updateOne({ _id: foreign._id }, { $set: { user: new Types.ObjectId() } })
    await recalculateSeededItems()
    expect(await readPreferences()).toEqual([
      { tag, weight: 0.5, count: 2, explicitWeight: 0 },
    ])
  })

  it("учитывает явную реакцию при каждом статусе кроме skipped", async () => {
    for (const status of Object.values(EUserItemStatus).filter(
      (value) => value !== EUserItemStatus.SKIPPED,
    )) {
      const tag = await seedTag()
      await seedReaction({ tag, status, isFavorite: true })
    }
    await recalculateSeededItems()
    const preferences = await readPreferences()
    expect(preferences).toHaveLength(Object.values(EUserItemStatus).length - 1)
    expect(
      preferences?.every(
        (preference) => preference.weight === 0.8 && preference.count === 1,
      ),
    ).toBe(true)
  })

  it("фильтрует удалённые и отсутствующие Item и Tag, нулевую выраженность и невкусовые группы", async () => {
    const tag = await seedTag()
    const live = await seedReaction({ tag, rating: 10, relevanceScore: 0.2 })
    await seedReaction({ tag, rating: 1, relevanceScore: 0 })
    await seedReaction({ tag, rating: 1, deletedAt: new Date() })
    const missing = await seedReaction({ tag, rating: 1 })
    await database?.connection
      .collection("Item")
      .deleteOne({ _id: missing.item })
    await seedReaction({ tag: new Types.ObjectId(), rating: 1 })
    await seedReaction({ tag: await seedTag(null), rating: 1 })
    await seedReaction({ tag: await seedTag(ETagGroup.COUNTRY), rating: 1 })
    expect(
      await itemTags.getTasteTags({
        itemIds: [live.item, missing.item],
        groups: [ETagGroup.GENRE],
        tagIds: [tag],
      }),
    ).toEqual([
      {
        item: live.item,
        tag,
        itemType: EItemType.MOVIE,
        group: ETagGroup.GENRE,
        relevanceScore: 0.2,
      },
    ])
    await recalculateSeededItems()
    expect(await readPreferences()).toEqual([
      { tag, weight: 0.2, count: 1, explicitWeight: 0 },
    ])
  })

  it("проверяет тип для диапазонного тега, не выводит родителей и не применяет weightModifier", async () => {
    const tag = await seedTag(ETagGroup.DURATION)
    const parent = await seedTag()
    await database?.connection
      .collection("TagRelation")
      .insertOne({ first: tag, second: parent, type: "parent" })
    await seedReaction({
      tag,
      rating: 10,
      type: EItemType.MOVIE,
      relevanceScore: 0.2,
    })
    await seedReaction({ tag, rating: 1, type: EItemType.GAME })
    await recalculateSeededItems()
    expect(await readPreferences()).toEqual([
      { tag, weight: 0.2, count: 1, explicitWeight: 0 },
    ])
  })

  it("заменяет прежнюю оценку и удаляет последний неявный вклад", async () => {
    const tag = await seedTag()
    const record = await seedReaction({ tag, rating: 10 })
    await recalculateSeededItems()
    await userItems.write.updateById(String(record._id), {
      $set: { rating: 1 },
    })
    await recalculateSeededItems()
    expect(await readPreferences()).toEqual([
      { tag, weight: -1, count: 1, explicitWeight: 0 },
    ])
    await userItems.write.deleteById(String(record._id))
    await recalculateSeededItems()
    expect(await readPreferences()).toEqual([])
  })

  it("пересчитывает только теги изменённого Item с учётом остальных произведений", async () => {
    const firstTag = await seedTag()
    const secondTag = await seedTag()
    const unrelatedTag = await seedTag()
    const changed = await seedReaction({ tag: firstTag, rating: 10 })
    await itemTags.write.create({
      item: changed.item,
      tag: secondTag,
      relevanceScore: 0.5,
    })
    await seedReaction({ tag: firstTag, rating: 1 })
    await seedReaction({ tag: secondTag, rating: 8 })
    await seedReaction({ tag: unrelatedTag, rating: 1 })
    await repository.write.create({
      user,
      tagPreferences: [
        { tag: firstTag, weight: -0.5, count: 5, explicitWeight: -0.4 },
        { tag: unrelatedTag, weight: 0.7, count: 7, explicitWeight: 0.2 },
      ],
    })

    await service.recalculate({ userId: user, itemId: changed.item }, context)

    expect(await readPreferences()).toEqual(
      expect.arrayContaining([
        { tag: firstTag, weight: 0, count: 2, explicitWeight: -0.4 },
        { tag: secondTag, weight: 0.5, count: 2, explicitWeight: 0 },
        { tag: unrelatedTag, weight: 0.7, count: 7, explicitWeight: 0.2 },
      ]),
    )
    expect(await readPreferences()).toHaveLength(3)

    await userItems.write.deleteById(String(changed._id))
    await service.recalculate({ userId: user, itemId: changed.item }, context)

    expect(await readPreferences()).toEqual(
      expect.arrayContaining([
        { tag: firstTag, weight: -1, count: 1, explicitWeight: -0.4 },
        { tag: secondTag, weight: 0.5, count: 1, explicitWeight: 0 },
        { tag: unrelatedTag, weight: 0.7, count: 7, explicitWeight: 0.2 },
      ]),
    )
    expect(await readPreferences()).toHaveLength(3)
  })

  it.each([0, 0.6])(
    "при удалении последнего вклада сохраняет только явную настройку %s затронутого тега",
    async (explicitWeight) => {
      const tag = await seedTag()
      const record = await seedReaction({ tag, rating: 10 })
      await repository.write.create({
        user,
        tagPreferences: [{ tag, weight: 1, count: 1, explicitWeight }],
      })
      await userItems.write.deleteById(String(record._id))

      await service.recalculate({ userId: user, itemId: record.item }, context)

      expect(await readPreferences()).toEqual(
        explicitWeight === 0
          ? []
          : [{ tag, weight: 0, count: 0, explicitWeight }],
      )
    },
  )

  it.each([
    { rating: null, completed: 1, weight: 0.1 },
    { rating: null, completed: 4, weight: 0.3 },
    { rating: 7, completed: 2, weight: 0.45 },
    { rating: 4, completed: 3, weight: -0.25 },
  ])(
    "считает $completed завершённых попыток с оценкой $rating как одно подтверждение веса $weight",
    async ({ rating, completed, weight }) => {
      const tag = await seedTag()
      const record = await seedReaction({ tag, rating })
      await userItems.write.updateById(String(record._id), {
        $set: {
          attempts: Array.from({ length: completed + 1 }, (_, index) => ({
            id: new Types.ObjectId(),
            isCompleted: index < completed,
            progress: 100,
            unit: EUnit.PERCENT,
            startedAt: null,
            completedAt: new Date("2026-10-01T00:00:00Z"),
          })),
        },
      })

      await service.recalculate({ userId: user, itemId: record.item }, context)

      const preferences = await readPreferences()
      expect(preferences).toHaveLength(1)
      expect(preferences?.[0]).toMatchObject({
        tag,
        count: 1,
        explicitWeight: 0,
      })
      expect(preferences?.[0].weight).toBeCloseTo(weight)
    },
  )

  it.each([false, true])(
    "сохраняет оба конкурентных расчёта разных Item при общих тегах=%s",
    async (isSharedTag) => {
      const firstTag = await seedTag()
      const secondTag = isSharedTag ? firstTag : await seedTag()
      const first = await seedReaction({ tag: firstTag, rating: 10 })
      const second = await seedReaction({ tag: secondTag, rating: 10 })
      await repository.write.create({
        user,
        tagPreferences: [{ tag: firstTag, weight: -0.5, count: 2 }],
      })
      let releaseRead = () => {}
      let reportRead = () => {}
      const canContinue = new Promise<void>((resolve) => {
        releaseRead = resolve
      })
      const readStarted = new Promise<void>((resolve) => {
        reportRead = resolve
      })
      const getTags = itemTags.getTasteTags.bind(itemTags)
      jest
        .spyOn(itemTags, "getTasteTags")
        .mockImplementationOnce(async (props) => {
          reportRead()
          await canContinue

          return await getTags(props)
        })
      const publish = jest.spyOn(repository, "tryReplaceCalculatedPreferences")
      const firstRun = service.recalculate(
        { userId: user, itemId: first.item },
        context,
      )

      try {
        await readStarted
        await userItems.write.updateById(String(second._id), {
          $set: { rating: 1 },
        })
        await service.recalculate(
          { userId: user, itemId: second.item },
          context,
        )
      } finally {
        releaseRead()
        await firstRun
      }

      expect(publish).toHaveBeenCalledTimes(3)
      expect(await readPreferences()).toEqual(
        isSharedTag
          ? [{ tag: firstTag, weight: 0, count: 2, explicitWeight: 0 }]
          : expect.arrayContaining([
              { tag: firstTag, weight: 1, count: 1, explicitWeight: 0 },
              { tag: secondTag, weight: -1, count: 1, explicitWeight: 0 },
            ]),
      )
      expect(await readPreferences()).toHaveLength(isSharedTag ? 1 : 2)
    },
  )

  it("не создаёт пустой профиль и пропускает отсутствующего пользователя", async () => {
    await recalculateSeededItems()
    expect(await profiles.countDocuments()).toBe(0)
    const tag = await seedTag()
    await seedReaction({ tag, rating: 10 })
    await database?.connection.collection("User").deleteOne({ _id: user })
    await recalculateSeededItems()
    expect(await profiles.countDocuments()).toBe(0)
  })

  it("считает произведение один раз независимо от количества завершённых попыток", async () => {
    const tag = await seedTag()
    const record = await seedReaction({ tag, rating: 10 })
    await userItems.write.updateById(String(record._id), {
      $set: {
        attempts: Array.from({ length: 3 }, () => ({
          id: new Types.ObjectId(),
          isCompleted: true,
          progress: 100,
          unit: EUnit.PERCENT,
          startedAt: null,
          completedAt: null,
        })),
      },
    })
    await recalculateSeededItems()
    expect(await readPreferences()).toEqual([
      { tag, weight: 1, count: 1, explicitWeight: 0 },
    ])
    await expect(
      userItems.write.create({
        user,
        item: record.item,
        status: EUserItemStatus.PLANNED,
      }),
    ).rejects.toMatchObject({ code: 11000 })
    await expect(
      itemTags.write.create({ item: record.item, tag, relevanceScore: 1 }),
    ).rejects.toMatchObject({ code: 11000 })
  })

  it("обновляет затронутый тег и сохраняет явные настройки и расчёты остальных тегов", async () => {
    const tag = await seedTag()
    const explicit = await seedTag()
    const stale = await seedTag()
    await repository.write.create({
      user,
      tagPreferences: [
        { tag, weight: -1, count: 8, explicitWeight: -0.7 },
        { tag: explicit, weight: 1, count: 4, explicitWeight: 0.6 },
        { tag: stale, weight: 1, count: 3 },
      ],
    })
    await seedReaction({ tag, rating: 10 })
    await recalculateSeededItems()
    expect(await readPreferences()).toEqual([
      { tag, weight: 1, count: 1, explicitWeight: -0.7 },
      { tag: explicit, weight: 1, count: 4, explicitWeight: 0.6 },
      { tag: stale, weight: 1, count: 3, explicitWeight: 0 },
    ])
  })

  it("возвращает false при конкурентном изменении массива и сохраняет актуальную явную настройку при повторе", async () => {
    const tag = await seedTag()
    await repository.write.create({
      user,
      tagPreferences: [{ tag, weight: 0, count: 1 }],
    })
    const update = repository.write.updateByFilter.bind(repository.write)
    const spy = jest
      .spyOn(repository.write, "updateByFilter")
      .mockImplementationOnce(async (...args) => {
        await profiles.collection.updateOne(
          { user },
          { $set: { "tagPreferences.0.explicitWeight": -0.8 } },
        )
        return await update(...args)
      })
    await expect(
      replacePreferences([{ tag, weight: 1, count: 1 }]),
    ).resolves.toBe(false)
    expect(await readPreferences()).toEqual([
      { tag, weight: 0, count: 1, explicitWeight: -0.8 },
    ])
    spy.mockRestore()
    await seedReaction({ tag, rating: 10 })
    await recalculateSeededItems()
    expect(await readPreferences()).toEqual([
      { tag, weight: 1, count: 1, explicitWeight: -0.8 },
    ])
  })

  it.each([0, 0.4])(
    "сохраняет конкурентную явную настройку %s после повторного слияния",
    async (explicitWeight) => {
      const tag = await seedTag()
      await repository.write.create({
        user,
        tagPreferences: [{ tag, count: 1, explicitWeight: 0.7 }],
      })
      await seedReaction({ tag, rating: 10 })
      const update = repository.write.updateByFilter.bind(repository.write)
      const spy = jest
        .spyOn(repository.write, "updateByFilter")
        .mockImplementationOnce(async (...args) => {
          await profiles.collection.updateOne(
            { user },
            { $set: { "tagPreferences.0.explicitWeight": explicitWeight } },
          )
          return await update(...args)
        })
      await recalculateSeededItems()
      expect(spy).toHaveBeenCalledTimes(2)
      expect(await readPreferences()).toEqual([
        { tag, weight: 1, count: 1, explicitWeight },
      ])
    },
  )

  it("обрабатывает гонку первого insert и сохраняет созданный конкурентом explicitWeight", async () => {
    const tag = await seedTag()
    const create = repository.write.create.bind(repository.write)
    jest
      .spyOn(repository.write, "create")
      .mockImplementationOnce(async (...args) => {
        await create({ user, tagPreferences: [{ tag, explicitWeight: -0.6 }] })
        return await create(...args)
      })
    await expect(
      replacePreferences([{ tag, weight: 1, count: 1 }]),
    ).resolves.toBe(false)
    await expect(
      replacePreferences([{ tag, weight: 1, count: 1 }]),
    ).resolves.toBe(true)
    expect(await profiles.countDocuments({ user })).toBe(1)
    expect(await readPreferences()).toEqual([
      { tag, weight: 1, count: 1, explicitWeight: -0.6 },
    ])
  })

  it("сравнивает исходный raw-массив без подстановки значений схемы", async () => {
    const tag = await seedTag()
    await profiles.collection.insertOne({
      user,
      tagPreferences: [{ tag, count: 1, explicitWeight: 0.5 }],
    })
    await expect(
      replacePreferences([{ tag, weight: 0.25, count: 1 }]),
    ).resolves.toBe(true)
    expect(await readPreferences()).toEqual([
      { tag, weight: 0.25, count: 1, explicitWeight: 0.5 },
    ])
  })

  it.each([
    { weight: 1.01, count: 1 },
    { weight: -1.01, count: 1 },
    { weight: Infinity, count: 1 },
    { weight: NaN, count: 1 },
    { weight: 0, count: -1 },
    { weight: 0, count: 0.5 },
    { weight: 0, count: Number.MAX_SAFE_INTEGER + 1 },
  ])(
    "отклоняет невалидный расчёт weight=$weight,count=$count без частичной публикации",
    async (calculated) => {
      const tag = await seedTag()
      await repository.write.create({
        user,
        tagPreferences: [{ tag, weight: 0.7, count: 2 }],
      })
      await expect(
        replacePreferences([{ tag, ...calculated }]),
      ).rejects.toMatchObject({
        name: Number.isNaN(calculated.weight) ? "CastError" : "ValidationError",
      })
      expect(await readPreferences()).toEqual([
        { tag, weight: 0.7, count: 2, explicitWeight: 0 },
      ])
    },
  )

  it("проверяет уникальность и диапазон explicitWeight при записи полного массива", async () => {
    const tag = await seedTag()
    await expect(
      repository.write.create({
        user,
        tagPreferences: [
          { tag, count: 1 },
          { tag, count: 1 },
        ],
      }),
    ).rejects.toMatchObject({ name: "ValidationError" })
    await expect(
      repository.write.create({
        user,
        tagPreferences: [{ tag, explicitWeight: 1.1 }],
      }),
    ).rejects.toMatchObject({ name: "ValidationError" })
    expect(await profiles.countDocuments()).toBe(0)
  })

  it("допускает 4096 тегов, но отклоняет 4097 с учётом сохранённых явных настроек", async () => {
    const preferences = Array.from({ length: 4096 }, () => ({
      tag: new Types.ObjectId(),
      weight: 0.5,
      count: 1,
    }))
    await expect(replacePreferences(preferences)).resolves.toBe(true)
    expect(await readPreferences()).toHaveLength(4096)
    await profiles.collection.updateOne(
      { user },
      { $set: { "tagPreferences.0.explicitWeight": 0.8 } },
    )
    const replacement = [
      ...preferences.slice(1),
      { tag: new Types.ObjectId(), weight: 0.5, count: 1 },
    ]
    await expect(replacePreferences(replacement)).rejects.toMatchObject({
      name: "ValidationError",
    })
    expect(await readPreferences()).toHaveLength(4096)
  })

  it("оставляет старый профиль доступным до атомарной публикации", async () => {
    const tag = await seedTag()
    await repository.write.create({
      user,
      tagPreferences: [{ tag, weight: -0.5, count: 2 }],
    })
    await seedReaction({ tag, rating: 10 })
    const getTags = itemTags.getTasteTags.bind(itemTags)
    jest
      .spyOn(itemTags, "getTasteTags")
      .mockImplementationOnce(async (...args) => {
        expect(await readPreferences()).toEqual([
          { tag, weight: -0.5, count: 2, explicitWeight: 0 },
        ])
        return await getTags(...args)
      })
    await recalculateSeededItems()
    expect(await readPreferences()).toEqual([
      { tag, weight: 1, count: 1, explicitWeight: 0 },
    ])
  })

  it("объединяет ожидающие задачи по пользователю и Item, сохраняя разные Item отдельно", async () => {
    const first = await service.enqueue(user, queuedItemId)
    expect(await service.enqueue(user, queuedItemId)).toBe(first)
    const other = await service.enqueue(new Types.ObjectId(), queuedItemId)
    expect(other).not.toBe(first)
    const otherItem = await service.enqueue(user, new Types.ObjectId())
    expect(otherItem).not.toBe(first)
    expect(otherItem).not.toBe(other)
    expect(await queue.getWaitingCount()).toBe(3)
    const queued = await queue.getJob(first)
    expect(queued?.data).toEqual({
      name: "userTasteProfile.recalculate",
      version: 2,
      payload: { userId: String(user), itemId: String(queuedItemId) },
      retryDelays: [5000, 30000, 120000],
      cancellationState: "none",
    })
    expect(queued?.opts).toMatchObject({
      attempts: 4,
      deduplication: {
        id: `userTasteProfile.recalculate:${user}:${queuedItemId}`,
        keepLastIfActive: true,
      },
    })
    expect(queued?.opts.deduplication).not.toHaveProperty("ttl")
    await queue.resume()
    await waitForCompletedCount(3)
  })

  it("повторяет неуспешный расчёт через очередь и объединяет изменения во время задержки", async () => {
    const tag = await seedTag()
    await seedReaction({ tag, rating: 10 })
    const publish = jest
      .spyOn(repository, "tryReplaceCalculatedPreferences")
      .mockRejectedValueOnce(new Error("temporary publication failure"))
    const id = await service.enqueue(user, queuedItemId)
    await queue.resume()
    const deadline = Date.now() + 4000
    while (Date.now() < deadline && (await queue.getDelayedCount()) === 0) {
      await setTimeout(20)
    }
    expect(await queue.getDelayedCount()).toBe(1)
    expect(await service.enqueue(user, queuedItemId)).toBe(id)
    const queued = await queue.getJob(id)
    expect(queued?.attemptsMade).toBe(1)
    await queued?.promote()
    await waitForCompletedCount(1)
    expect(publish).toHaveBeenCalledTimes(2)
    expect(await readPreferences()).toEqual([
      { tag, weight: 1, count: 1, explicitWeight: 0 },
    ])
  })

  it("сохраняет следующий запуск при изменениях во время выполнения и на границе завершения", async () => {
    const tag = await seedTag()
    const record = await seedReaction({ tag, rating: 10 })
    const publish = repository.tryReplaceCalculatedPreferences.bind(repository)
    let runs = 0
    jest
      .spyOn(repository, "tryReplaceCalculatedPreferences")
      .mockImplementation(async (...args) => {
        const isPublished = await publish(...args)
        runs += 1
        if (runs === 1) {
          await userItems.write.updateById(String(record._id), {
            $set: { rating: 1 },
          })
          await service.enqueue(user, queuedItemId)
          await service.enqueue(user, queuedItemId)
        }
        if (runs === 2) {
          await userItems.write.updateById(String(record._id), {
            $set: { rating: 8 },
          })
          await service.enqueue(user, queuedItemId)
        }
        return isPublished
      })
    const first = await service.enqueue(user, queuedItemId)
    await queue.resume()
    await waitForCompletedCount(3)
    expect(runs).toBe(3)
    expect((await queue.getJob(first))?.returnvalue).toEqual({
      calculatedTags: 1,
    })
    expect(await readPreferences()).toEqual([
      { tag, weight: 0.5, count: 1, explicitWeight: 0 },
    ])
    expect(await queue.getWaitingCount()).toBe(0)
    await service.enqueue(user, queuedItemId)
    await waitForCompletedCount(4)
    expect(runs).toBe(4)
    expect(RECALCULATE_USER_TASTE_PROFILE_JOB.name).toBe(
      "userTasteProfile.recalculate",
    )
  })
})
