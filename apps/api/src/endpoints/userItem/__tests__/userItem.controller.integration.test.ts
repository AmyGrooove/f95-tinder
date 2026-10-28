import { describe, expect, it, jest } from "@jest/globals"
import { Types } from "mongoose"
import type { FastifyInstance } from "fastify"

import { createAccount } from "@endpoints/account/__tests__/functions/createAccount"
import { ItemRatingsRecalculationService } from "@endpoints/itemRatings/services/itemRatingsRecalculation.service"
import { EItemType } from "@entities/item/schemas/EItemType"
import { ETagKey } from "@entities/tag/schemas/ETagKey"
import { ETagGroup } from "@entities/tag/schemas/ETagGroup"
import { ItemTagRepository } from "@entities/itemTag/services/itemTag.repository"
import { DICTIONARY } from "@entities/shared/static/DICTIONARY"
import { ItemRepository } from "@entities/item/services/item.repository"
import type { Item } from "@entities/item/schemas/item.schema"
import type { User } from "@entities/user/schemas/user.schema"
import type { Session } from "@entities/session/schemas/session.schema"
import { EUserItemStatus } from "@entities/userItem/schemas/EUserItemStatus"
import type { UserItem } from "@entities/userItem/schemas/userItem.schema"
import { UserItemRepository } from "@entities/userItem/services/userItem.repository"
import { UserTasteProfileRecalculationService } from "@entities/userTasteProfile/services/userTasteProfileRecalculation.service"
import { getTestApplication } from "@test/setup/setupIntegration"

import type { UserItemResponseDto } from "../dto/response/userItem.response"

describe("UserItemController HTTP", () => {
  it.each(["create", "skip", "block"] as const)(
    "ставит пересчёт после сохранения операции %s",
    async (operation) => {
      const { app, connection } = getTestApplication()
      const account = await createAccount()
      const item = await createItem()
      const enqueueRating = jest
        .spyOn(app.get(ItemRatingsRecalculationService), "enqueue")
        .mockImplementation(async (itemId) => {
          expect(itemId).toEqual(item._id)
          expect(
            await connection.collection("UserItem").countDocuments({
              user: account.user._id,
              item: itemId,
            }),
          ).toBe(1)

          return "rating-job"
        })
      const enqueue = jest
        .spyOn(app.get(UserTasteProfileRecalculationService), "enqueue")
        .mockImplementation(async (userId, itemId) => {
          expect(itemId).toEqual(item._id)
          expect(userId).toEqual(account.user._id)
          expect(
            await connection
              .collection("UserItem")
              .findOne({ user: userId, item: item._id }),
          ).toMatchObject({
            status:
              operation === "create"
                ? EUserItemStatus.PLANNED
                : operation === "skip"
                  ? EUserItemStatus.SKIPPED
                  : EUserItemStatus.BLOCKED,
          })
          return "queued"
        })
      const response = await app.inject({
        method: "POST",
        url: operation === "create" ? "/userItems" : `/userItems/${operation}`,
        headers: account.headers,
        payload:
          operation === "create"
            ? { itemId: String(item._id), status: EUserItemStatus.PLANNED }
            : { itemId: String(item._id) },
      })
      expect(response.statusCode).toBe(201)
      expect(enqueue).toHaveBeenCalledTimes(1)
      expect(enqueueRating).toHaveBeenCalledTimes(1)
    },
  )

  it.each(["update", "createAttempt", "updateAttempt"] as const)(
    "ставит пересчёт после commit операции %s",
    async (operation) => {
      const { app } = getTestApplication()
      const owner = await createEntry(EUserItemStatus.IN_PROGRESS)
      const enqueueRating = jest
        .spyOn(app.get(ItemRatingsRecalculationService), "enqueue")
        .mockImplementation(async (itemId) => {
          expect(itemId).toEqual(owner.item._id)
          const committed = await readEntry(owner.entry.id)
          if (operation === "update") {
            expect(committed.rating).toBe(9)
          } else if (operation === "createAttempt") {
            expect(committed.attempts).toHaveLength(2)
            expect(committed.attempts.at(-1)?.isCompleted).toBe(true)
          } else {
            expect(committed.attempts[0]?.isCompleted).toBe(true)
          }

          return "rating-job"
        })
      const enqueue = jest
        .spyOn(app.get(UserTasteProfileRecalculationService), "enqueue")
        .mockImplementation(async (userId, itemId) => {
          expect(itemId).toEqual(owner.item._id)
          expect(userId).toEqual(owner.user._id)
          const committed = await readEntry(owner.entry.id)
          if (operation === "update") {
            expect(committed.rating).toBe(9)
          } else if (operation === "createAttempt") {
            expect(committed.attempts).toHaveLength(2)
            expect(committed.attempts.at(-1)?.isCompleted).toBe(true)
          } else {
            expect(committed.attempts[0]?.isCompleted).toBe(true)
          }
          return "queued"
        })
      const response = await app.inject({
        method: operation === "createAttempt" ? "POST" : "PATCH",
        url:
          operation === "update"
            ? `/userItems/${owner.entry.id}`
            : operation === "createAttempt"
              ? `/userItems/${owner.entry.id}/attempts`
              : `/userItems/${owner.entry.id}/attempts/${owner.entry.attempts[0]?.id}`,
        headers: owner.headers,
        payload: operation === "update" ? { rating: 9 } : { isCompleted: true },
      })
      expect(response.statusCode).toBe(
        operation === "createAttempt" ? 201 : 200,
      )
      expect(enqueue).toHaveBeenCalledTimes(1)
      expect(enqueueRating).toHaveBeenCalledTimes(1)
    },
  )

  it.each([
    { field: "isFavorite", value: true, isTasteChanged: true },
    { field: "isFavorite", value: false, isTasteChanged: true },
    { field: "status", value: EUserItemStatus.ON_HOLD, isTasteChanged: false },
    { field: "status", value: EUserItemStatus.BLOCKED, isTasteChanged: false },
  ])(
    "пересчитывает метрики после изменения $field на $value",
    async ({ field, value, isTasteChanged }) => {
      const { app, connection } = getTestApplication()
      const owner = await createEntry(EUserItemStatus.IN_PROGRESS)
      if (value === false) {
        await connection
          .collection("UserItem")
          .updateOne(
            { _id: new Types.ObjectId(owner.entry.id) },
            { $set: { isFavorite: true } },
          )
      }
      const enqueueTaste = jest
        .spyOn(app.get(UserTasteProfileRecalculationService), "enqueue")
        .mockResolvedValue("taste-job")
      const enqueueMetric = jest
        .spyOn(app.get(ItemRatingsRecalculationService), "enqueue")
        .mockImplementation(async (itemId) => {
          expect(itemId).toEqual(owner.item._id)
          expect(await readEntry(owner.entry.id)).toMatchObject({
            [field]: value,
          })
          return "metric-job"
        })

      const response = await app.inject({
        method: "PATCH",
        url: `/userItems/${owner.entry.id}`,
        headers: owner.headers,
        payload: { [field]: value },
      })

      expect(response.statusCode).toBe(200)
      expect(enqueueMetric).toHaveBeenCalledTimes(1)
      expect(enqueueTaste).toHaveBeenCalledTimes(isTasteChanged ? 1 : 0)
    },
  )

  it.each(["create", "uncomplete"] as const)(
    "обновляет метрики при операции %s сверх лимита TasteProfile",
    async (operation) => {
      const { app } = getTestApplication()
      const owner = await createEntry(EUserItemStatus.IN_PROGRESS)
      const record = await app
        .get(UserItemRepository)
        .write.updateById(owner.entry.id, {
          $set: {
            attempts: Array.from(
              { length: operation === "create" ? 3 : 4 },
              () => ({ id: new Types.ObjectId(), isCompleted: true }),
            ),
          },
        })
      const enqueueTaste = jest
        .spyOn(app.get(UserTasteProfileRecalculationService), "enqueue")
        .mockResolvedValue("taste-job")
      const enqueueMetric = jest
        .spyOn(app.get(ItemRatingsRecalculationService), "enqueue")
        .mockImplementation(async (itemId) => {
          expect(itemId).toEqual(owner.item._id)
          const committed = await readEntry(owner.entry.id)
          expect(
            committed.attempts.filter((attempt) => attempt.isCompleted),
          ).toHaveLength(operation === "create" ? 4 : 3)
          return "metric-job"
        })
      const response = await app.inject({
        method: operation === "create" ? "POST" : "PATCH",
        url:
          operation === "create"
            ? `/userItems/${owner.entry.id}/attempts`
            : `/userItems/${owner.entry.id}/attempts/${record?.attempts[0]?.id}`,
        headers: owner.headers,
        payload: { isCompleted: operation === "create" },
      })

      expect(response.statusCode).toBe(operation === "create" ? 201 : 200)
      expect(enqueueMetric).toHaveBeenCalledTimes(1)
      expect(enqueueTaste).not.toHaveBeenCalled()
    },
  )

  it.each([
    { rating: null },
    { isFavorite: false },
    { status: EUserItemStatus.IN_PROGRESS },
    { isCompleted: false },
  ])(
    "не ставит пересчёт при повторной записи неизменившихся значений %j",
    async (payload) => {
      const { app } = getTestApplication()
      const owner = await createEntry(EUserItemStatus.IN_PROGRESS)
      const enqueueTaste = jest
        .spyOn(app.get(UserTasteProfileRecalculationService), "enqueue")
        .mockResolvedValue("taste-job")
      const enqueueMetric = jest
        .spyOn(app.get(ItemRatingsRecalculationService), "enqueue")
        .mockResolvedValue("metric-job")
      const response = await app.inject({
        method: "PATCH",
        url:
          "isCompleted" in payload
            ? `/userItems/${owner.entry.id}/attempts/${owner.entry.attempts[0]?.id}`
            : `/userItems/${owner.entry.id}`,
        headers: owner.headers,
        payload,
      })

      expect(response.statusCode).toBe(200)
      expect(enqueueMetric).not.toHaveBeenCalled()
      expect(enqueueTaste).not.toHaveBeenCalled()
    },
  )

  it.each(["note", "progress", "dates", "unfinishedAttempt"] as const)(
    "не запускает фоновые пересчёты при изменении только %s",
    async (operation) => {
      const { app } = getTestApplication()
      const owner = await createEntry(EUserItemStatus.IN_PROGRESS)
      const enqueueTaste = jest
        .spyOn(app.get(UserTasteProfileRecalculationService), "enqueue")
        .mockResolvedValue("taste-job")
      const enqueueRating = jest
        .spyOn(app.get(ItemRatingsRecalculationService), "enqueue")
        .mockResolvedValue("rating-job")
      const isAttempt = operation !== "note"
      const response = await app.inject({
        method: operation === "unfinishedAttempt" ? "POST" : "PATCH",
        url: !isAttempt
          ? `/userItems/${owner.entry.id}`
          : operation === "unfinishedAttempt"
            ? `/userItems/${owner.entry.id}/attempts`
            : `/userItems/${owner.entry.id}/attempts/${owner.entry.attempts[0]?.id}`,
        headers: owner.headers,
        payload:
          operation === "note"
            ? { note: "Заметка" }
            : operation === "dates"
              ? {
                  startedAt: "2026-10-01T00:00:00Z",
                  completedAt: "2026-10-02T00:00:00Z",
                }
              : { progress: 42 },
      })

      expect(response.statusCode).toBe(
        operation === "unfinishedAttempt" ? 201 : 200,
      )
      expect(enqueueTaste).not.toHaveBeenCalled()
      expect(enqueueRating).not.toHaveBeenCalled()
      const saved = await readEntry(owner.entry.id)
      if (operation === "note") {
        expect(saved.note).toBe("Заметка")
      } else if (operation === "dates") {
        expect(saved.attempts[0].completedAt).toEqual(
          new Date("2026-10-02T00:00:00Z"),
        )
        expect(saved.attempts[0].isCompleted).toBe(false)
      } else {
        expect(saved.attempts.at(-1)?.progress).toBe(42)
      }
    },
  )

  it.each([null, 8])(
    "ставит пересчёты после удаления записи с оценкой %s",
    async (rating) => {
      const { app, connection } = getTestApplication()
      const owner = await createEntry()
      await connection
        .collection("UserItem")
        .updateOne(
          { _id: new Types.ObjectId(owner.entry.id) },
          { $set: { rating } },
        )
      const enqueueRating = jest
        .spyOn(app.get(ItemRatingsRecalculationService), "enqueue")
        .mockImplementation(async (itemId) => {
          expect(itemId).toEqual(owner.item._id)
          expect(
            await connection.collection("UserItem").countDocuments({
              _id: new Types.ObjectId(owner.entry.id),
            }),
          ).toBe(0)

          return "rating-job"
        })
      const enqueue = jest
        .spyOn(app.get(UserTasteProfileRecalculationService), "enqueue")
        .mockImplementation(async (userId, itemId) => {
          expect(itemId).toEqual(owner.item._id)
          expect(userId).toEqual(owner.user._id)
          expect(
            await connection
              .collection("UserItem")
              .countDocuments({ _id: new Types.ObjectId(owner.entry.id) }),
          ).toBe(0)
          return "queued"
        })
      const response = await app.inject({
        method: "DELETE",
        url: `/userItems/${owner.entry.id}`,
        headers: owner.headers,
      })
      expect(response.statusCode).toBe(204)
      expect(enqueue).toHaveBeenCalledTimes(1)
      expect(enqueueRating).toHaveBeenCalledTimes(1)
    },
  )

  it("не ставит пересчёт при отказе создания, удаления и откате изменения", async () => {
    const { app } = getTestApplication()
    const owner = await createEntry(EUserItemStatus.PLANNED)
    const enqueueRating = jest
      .spyOn(app.get(ItemRatingsRecalculationService), "enqueue")
      .mockResolvedValue("rating-job")
    const enqueue = jest
      .spyOn(app.get(UserTasteProfileRecalculationService), "enqueue")
      .mockResolvedValue("queued")
    const duplicate = await app.inject({
      method: "POST",
      url: "/userItems",
      headers: owner.headers,
      payload: {
        itemId: String(owner.item._id),
        status: EUserItemStatus.PLANNED,
      },
    })
    expect(duplicate.statusCode).toBe(409)
    const update = await app.inject({
      method: "PATCH",
      url: `/userItems/${owner.entry.id}`,
      headers: owner.headers,
      payload: { status: EUserItemStatus.SKIPPED, rating: 10 },
    })
    expect(update.statusCode).toBe(409)
    const remove = await app.inject({
      method: "DELETE",
      url: `/userItems/${new Types.ObjectId()}`,
      headers: owner.headers,
    })
    expect(remove.statusCode).toBe(404)
    const attempt = await app.inject({
      method: "POST",
      url: `/userItems/${owner.entry.id}/attempts`,
      headers: owner.headers,
      payload: { progress: 1 },
    })
    expect(attempt.statusCode).toBe(409)
    expect(enqueue).not.toHaveBeenCalled()
    expect(enqueueRating).not.toHaveBeenCalled()
    expect(await readEntry(owner.entry.id)).toMatchObject({
      status: EUserItemStatus.PLANNED,
      rating: null,
      attempts: [],
    })
  })

  it.each(["create", "update"] as const)(
    "передаёт ошибку очереди после сохранённой операции %s",
    async (operation) => {
      const { app, connection } = getTestApplication()
      const owner = await createEntry()
      const item = await createItem()
      jest
        .spyOn(app.get(UserTasteProfileRecalculationService), "enqueue")
        .mockRejectedValue(new Error("Redis unavailable"))
      const response = await app.inject({
        method: operation === "create" ? "POST" : "PATCH",
        url:
          operation === "create"
            ? "/userItems"
            : `/userItems/${owner.entry.id}`,
        headers: owner.headers,
        payload:
          operation === "create"
            ? { itemId: String(item._id), status: EUserItemStatus.PLANNED }
            : { rating: 9 },
      })
      expect(response.statusCode).toBe(500)
      if (operation === "create") {
        expect(
          await connection
            .collection("UserItem")
            .findOne({ user: owner.user._id, item: item._id }),
        ).toMatchObject({ status: EUserItemStatus.PLANNED })
      } else {
        expect((await readEntry(owner.entry.id)).rating).toBe(9)
      }
    },
  )

  it.each([61, 100])(
    "отклоняет QUERY с %i ID без чтения и изменения личных записей",
    async (count) => {
      const { app, connection } = getTestApplication()
      const owner = await createAccount()
      const repository = app.get(UserItemRepository)
      const read = jest.spyOn(repository.read, "findMany")
      const response = await getFastify().inject({
        method: "QUERY",
        url: "/userItems",
        headers: owner.headers,
        payload: {
          ids: Array.from({ length: count }, () =>
            new Types.ObjectId().toHexString(),
          ),
        },
      })
      expect(response.statusCode).toBe(400)
      expect(read).not.toHaveBeenCalled()
      expect(await connection.collection("UserItem").countDocuments()).toBe(0)
    },
  )

  it("возвращает все 60 запрошенных собственных записей без усечения", async () => {
    const { connection } = getTestApplication()
    const owner = await createAccount()
    const records = Array.from({ length: 60 }, () => ({
      _id: new Types.ObjectId(),
      user: owner.user._id,
      item: new Types.ObjectId(),
      status: EUserItemStatus.PLANNED,
      rating: null,
      isFavorite: false,
      attempts: [],
      note: null,
      expiresAt: null,
    }))
    await connection.collection("UserItem").insertMany(records)
    const requested = [...records].reverse()
    const response = await getFastify().inject({
      method: "QUERY",
      url: "/userItems",
      headers: owner.headers,
      payload: { ids: requested.map((record) => record._id.toHexString()) },
    })
    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual(
      requested.map((record) => ({
        id: record._id.toHexString(),
        itemId: record.item.toHexString(),
        rating: null,
        isFavorite: false,
        status: EUserItemStatus.PLANNED,
      })),
    )
    expect(await connection.collection("UserItem").countDocuments()).toBe(60)
  })

  const getFastify = (): FastifyInstance => {
    return getTestApplication().app.getHttpAdapter().getInstance()
  }

  const synchronizeMutationReads = (count: number) => {
    const repository = getTestApplication().app.get(UserItemRepository).read
    const findOne = repository.findOne.bind(repository)
    let reads = 0
    let release = () => {}
    const ready = new Promise<void>((resolve) => {
      release = resolve
    })

    jest.spyOn(repository, "findOne").mockImplementation(async (...args) => {
      const record = await findOne(...args)
      reads += 1

      if (reads <= count) {
        if (reads === count) {
          release()
        }

        await ready
      }

      return record
    })
  }

  const createItem = async (type: EItemType = EItemType.MOVIE) => {
    return getTestApplication()
      .app.get(ItemRepository)
      .write.create({
        type,
        title: { ru: "Тестовый фильм", en: null },
      })
  }

  const createEntry = async (
    status: EUserItemStatus = EUserItemStatus.PLANNED,
    type: EItemType = EItemType.MOVIE,
  ) => {
    const account = await createAccount()
    const item = await createItem(type)
    const response = await getTestApplication().app.inject({
      method: "POST",
      url: "/userItems",
      headers: account.headers,
      payload: { itemId: item._id.toHexString(), status },
    })
    expect(response.statusCode).toBe(201)

    return { ...account, item, entry: response.json<UserItemResponseDto>() }
  }

  const readEntry = async (id: string) => {
    const record = await getTestApplication()
      .connection.collection<UserItem>("UserItem")
      .findOne({ _id: new Types.ObjectId(id) })

    if (record === null) {
      throw new Error("Тестовая запись библиотеки не найдена")
    }

    return record
  }

  const createCompletionTag = async (props: {
    item: Types.ObjectId
    key: string
    group: ETagGroup
    isAssigned?: boolean
  }) => {
    const { app, connection } = getTestApplication()
    const tag = {
      _id: new Types.ObjectId(),
      key: props.key,
      group: props.group,
      name: { ru: props.key, en: null },
    }
    await connection.collection("Tag").insertOne(tag)

    if (props.isAssigned !== false) {
      await app.get(ItemTagRepository).write.create({
        item: props.item,
        tag: tag._id,
        relevanceScore: 1,
      })
    }
  }

  it.each([
    EItemType.SERIES,
    EItemType.ANIMATED_SERIES,
    EItemType.ANIME_SERIES,
  ])(
    "сохраняет и редактирует число серий сезона %s без вывода завершения",
    async (type) => {
      const { app, connection } = getTestApplication()
      const { entry, item, headers } = await createEntry(
        EUserItemStatus.IN_PROGRESS,
        type,
      )
      await connection
        .collection("Item")
        .updateOne({ _id: item._id }, { $set: { deletedAt: new Date() } })
      const url = `/userItems/${entry.id}/attempts`
      const created = await app.inject({
        method: "POST",
        url,
        headers,
        payload: { unit: "episode", progress: 0 },
      })
      expect(created.statusCode).toBe(201)
      const attempt = created.json<UserItemResponseDto>().attempts.at(-1)
      expect(attempt).toMatchObject({
        unit: "episode",
        progress: 0,
        isCompleted: false,
      })
      const updated = await app.inject({
        method: "PATCH",
        url: `${url}/${attempt?.id}`,
        headers,
        payload: { progress: 120 },
      })
      expect(updated.statusCode).toBe(200)
      expect(updated.json<UserItemResponseDto>().status).toBe("inProgress")
      expect((await readEntry(entry.id)).attempts.at(-1)).toMatchObject({
        unit: "episode",
        progress: 120,
        isCompleted: false,
      })
      const changed = await app.inject({
        method: "PATCH",
        url: `${url}/${entry.attempts[0]?.id}`,
        headers,
        payload: { unit: "episode", progress: 5 },
      })
      expect(changed.statusCode).toBe(200)
      expect((await readEntry(entry.id)).attempts[0]).toMatchObject({
        unit: "episode",
        progress: 5,
      })
    },
  )

  it.each([
    EItemType.MOVIE,
    EItemType.ANIMATED_MOVIE,
    EItemType.ANIME_MOVIE,
    EItemType.GAME,
    "missing" as const,
  ])("отклоняет серии для %s без частичного сохранения", async (type) => {
    const { app, connection } = getTestApplication()
    const { entry, item, headers } = await createEntry(
      EUserItemStatus.IN_PROGRESS,
      type === "missing" ? EItemType.SERIES : type,
    )
    if (type === "missing") {
      await connection.collection("Item").deleteOne({ _id: item._id })
    }
    const before = await readEntry(entry.id)
    for (const method of ["POST", "PATCH"] as const) {
      const response = await app.inject({
        method,
        url:
          `/userItems/${entry.id}/attempts` +
          (method === "PATCH" ? `/${entry.attempts[0]?.id}` : ""),
        headers,
        payload: { unit: "episode", progress: 5 },
      })
      expect(response.statusCode).toBe(400)
      expect(response.json()).toMatchObject({
        error: { message: DICTIONARY.userItem.invalidEpisodeUnit },
      })
      expect(await readEntry(entry.id)).toEqual(before)
    }
  })

  it.each([
    {
      type: EItemType.GAME,
      key: ETagKey.HAS_DEFINED_END_FALSE,
      group: ETagGroup.HAS_DEFINED_END,
      message: DICTIONARY.userItem.gameHasNoDefinedEnd,
    },
    ...[
      EItemType.SERIES,
      EItemType.ANIMATED_SERIES,
      EItemType.ANIME_SERIES,
    ].flatMap((type) =>
      [ETagKey.RELEASE_STATUS_ANNOUNCED, ETagKey.RELEASE_STATUS_ONGOING].map(
        (key) => ({
          type,
          key,
          group: ETagGroup.RELEASE_STATUS,
          message: DICTIONARY.userItem.seasonReleaseNotFinished,
        }),
      ),
    ),
  ])(
    "запрещает явное завершение $type при теге $key и сохраняет запись",
    async ({ type, key, group, message }) => {
      const { app, connection } = getTestApplication()
      const { entry, item, headers } = await createEntry(
        EUserItemStatus.IN_PROGRESS,
        type,
      )
      await createCompletionTag({ item: item._id, key, group })
      const before = await readEntry(entry.id)
      for (const request of [
        {
          method: "PATCH",
          url: `/userItems/${entry.id}`,
          payload: { status: "completed", note: "Не сохранить" },
        },
        {
          method: "POST",
          url: `/userItems/${entry.id}/attempts`,
          payload: { isCompleted: true },
        },
        {
          method: "PATCH",
          url: `/userItems/${entry.id}/attempts/${entry.attempts[0]?.id}`,
          payload: { isCompleted: true, progress: 10 },
        },
      ] as const) {
        const response = await app.inject({ ...request, headers })
        expect(response.statusCode).toBe(409)
        expect(response.json()).toMatchObject({ error: { message } })
        expect(await readEntry(entry.id)).toEqual(before)
      }
      const database = connection.db
      if (database === undefined) {
        throw new Error("Тестовая MongoDB не подключена")
      }
      await database.command({
        collMod: "UserItem",
        index: { name: "userItemSkippedExpiry", expireAfterSeconds: 3600 },
      })
      try {
        await connection.collection("UserItem").updateOne(
          { _id: new Types.ObjectId(entry.id) },
          {
            $set: {
              status: "skipped",
              attempts: [],
              expiresAt: new Date(Date.now() - 1000),
            },
          },
        )
        const skipped = await readEntry(entry.id)
        const rejected = await app.inject({
          method: "POST",
          url: "/userItems",
          headers,
          payload: { itemId: item._id.toHexString(), status: "completed" },
        })
        expect(rejected.statusCode).toBe(409)
        expect(rejected.json()).toMatchObject({ error: { message } })
        expect(await readEntry(entry.id)).toEqual(skipped)
      } finally {
        await database.command({
          collMod: "UserItem",
          index: { name: "userItemSkippedExpiry", expireAfterSeconds: 0 },
        })
      }
    },
  )

  it.each([
    { method: "POST", payload: { unit: "percent" } },
    { method: "POST", payload: { unit: "percent", progress: 0 } },
    { method: "PATCH", payload: { unit: "percent" } },
    { method: "PATCH", payload: { progress: 10 } },
  ] as const)(
    "запрещает $method процентный ввод $payload для игры без конца",
    async ({ method, payload }) => {
      const { app, connection } = getTestApplication()
      const { entry, item, headers } = await createEntry(
        EUserItemStatus.IN_PROGRESS,
        EItemType.GAME,
      )
      await createCompletionTag({
        item: item._id,
        key: ETagKey.HAS_DEFINED_END_FALSE,
        group: ETagGroup.HAS_DEFINED_END,
      })
      await connection
        .collection("UserItem")
        .updateOne(
          { _id: new Types.ObjectId(entry.id) },
          { $set: { "attempts.0.unit": "percent", "attempts.0.progress": 20 } },
        )
      const before = await readEntry(entry.id)
      const response = await app.inject({
        method,
        headers,
        payload,
        url:
          `/userItems/${entry.id}/attempts` +
          (method === "PATCH" ? `/${entry.attempts[0]?.id}` : ""),
      })
      expect(response.statusCode).toBe(409)
      expect(response.json()).toMatchObject({
        error: { message: DICTIONARY.userItem.gameHasNoDefinedEnd },
      })
      expect(await readEntry(entry.id)).toEqual(before)
    },
  )

  it.each([
    {
      type: EItemType.GAME,
      key: "hasDefinedEndTrue",
      group: ETagGroup.HAS_DEFINED_END,
    },
    {
      type: EItemType.GAME,
      key: ETagKey.HAS_DEFINED_END_FALSE,
      group: ETagGroup.KEYWORD,
    },
    {
      type: EItemType.GAME,
      key: ETagKey.HAS_DEFINED_END_FALSE,
      group: ETagGroup.HAS_DEFINED_END,
      isAssigned: false,
    },
    ...["releaseStatusReleased", "releaseStatusCancelled"].map((key) => ({
      type: EItemType.SERIES,
      key,
      group: ETagGroup.RELEASE_STATUS,
    })),
    {
      type: EItemType.SERIES,
      key: ETagKey.RELEASE_STATUS_ONGOING,
      group: ETagGroup.RELEASE_STATUS,
      isAssigned: false,
    },
    {
      type: EItemType.SERIES,
      key: ETagKey.RELEASE_STATUS_ONGOING,
      group: ETagGroup.KEYWORD,
    },
  ])(
    "разрешает ручное завершение $type при теге $group/$key, назначение=$isAssigned",
    async ({ type, ...tag }) => {
      const { app } = getTestApplication()
      const { headers } = await createAccount()
      const item = await createItem(type)
      await createCompletionTag({ ...tag, item: item._id })
      const created = await app.inject({
        method: "POST",
        url: "/userItems",
        headers,
        payload: { itemId: item._id.toHexString(), status: "completed" },
      })
      expect(created.statusCode).toBe(201)
      const entry = created.json<UserItemResponseDto>()
      const updated = await app.inject({
        method: "PATCH",
        url: `/userItems/${entry.id}`,
        headers,
        payload: { status: "completed" },
      })
      expect(updated.statusCode).toBe(200)
      const attempt = await app.inject({
        method: "POST",
        url: `/userItems/${entry.id}/attempts`,
        headers,
        payload: { isCompleted: true, unit: "percent", progress: 100 },
      })
      expect(attempt.statusCode).toBe(201)
      expect((await readEntry(entry.id)).attempts.at(-1)).toMatchObject({
        isCompleted: true,
        unit: "percent",
        progress: 100,
      })
    },
  )

  it.each([EItemType.GAME, EItemType.SERIES])(
    "разрешает завершение %s без назначенных тегов завершения",
    async (type) => {
      const { entry } = await createEntry(EUserItemStatus.COMPLETED, type)
      expect(entry.attempts[0]?.isCompleted).toBe(true)
    },
  )

  it.each([EItemType.GAME, EItemType.SERIES])(
    "сохраняет историческое завершение %s при разрешённых правках",
    async (type) => {
      const { app } = getTestApplication()
      const { entry, item, headers } = await createEntry(
        EUserItemStatus.COMPLETED,
        type,
      )
      const url = `/userItems/${entry.id}`
      const attemptUrl = `${url}/attempts/${entry.attempts[0]?.id}`
      const prepared = await app.inject({
        method: "PATCH",
        url: attemptUrl,
        headers,
        payload: { unit: "percent", progress: 100 },
      })
      expect(prepared.statusCode).toBe(200)
      await createCompletionTag({
        item: item._id,
        key:
          type === EItemType.GAME
            ? ETagKey.HAS_DEFINED_END_FALSE
            : ETagKey.RELEASE_STATUS_ONGOING,
        group:
          type === EItemType.GAME
            ? ETagGroup.HAS_DEFINED_END
            : ETagGroup.RELEASE_STATUS,
      })
      for (const payload of [
        { rating: 8, note: "История", isFavorite: true },
        { status: "onHold" },
      ]) {
        const response = await app.inject({
          method: "PATCH",
          url,
          headers,
          payload,
        })
        expect(response.statusCode).toBe(200)
        expect(response.json<UserItemResponseDto>().attempts[0]).toMatchObject({
          isCompleted: true,
          unit: "percent",
          progress: 100,
        })
      }
      for (const payload of [
        { completedAt: "2026-10-01T00:00:00.000Z" },
        { progress: null },
        { isCompleted: false },
        { unit: "minute", progress: 120 },
      ]) {
        const response = await app.inject({
          method: "PATCH",
          url: attemptUrl,
          headers,
          payload,
        })
        expect(response.statusCode).toBe(200)
        expect(response.json<UserItemResponseDto>().attempts[0]).toMatchObject(
          payload,
        )
      }
      const allowed = await app.inject({
        method: "POST",
        url: `${url}/attempts`,
        headers,
        payload:
          type === EItemType.GAME
            ? { progress: 120 }
            : { unit: "percent", progress: 100 },
      })
      expect(allowed.statusCode).toBe(201)
      expect((await readEntry(entry.id)).attempts.at(-1)?.isCompleted).toBe(
        false,
      )
    },
  )

  it("сохраняет запланированное произведение с обязательным статусом и значениями по умолчанию", async () => {
    const { entry, item, user } = await createEntry()

    expect(entry).toEqual({
      id: expect.stringMatching(/^[a-f0-9]{24}$/),
      itemId: item._id.toHexString(),
      status: EUserItemStatus.PLANNED,
      expiresAt: null,
      rating: null,
      isFavorite: false,
      note: null,
      attempts: [],
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    })
    expect(await readEntry(entry.id)).toMatchObject({
      user: user._id,
      item: item._id,
      status: EUserItemStatus.PLANNED,
      expiresAt: null,
      rating: null,
      isFavorite: false,
      note: null,
      attempts: [],
    })
  })

  it.each([
    EUserItemStatus.IN_PROGRESS,
    EUserItemStatus.ON_HOLD,
    EUserItemStatus.COMPLETED,
    EUserItemStatus.DROPPED,
  ])("создаёт первую попытку при добавлении со статусом %s", async (status) => {
    const { entry } = await createEntry(status)

    expect(entry.status).toBe(status)
    expect(entry.attempts).toHaveLength(1)
    expect(entry.attempts[0]).toMatchObject({
      id: expect.stringMatching(/^[a-f0-9]{24}$/),
      isCompleted: status === EUserItemStatus.COMPLETED,
      startedAt: null,
      completedAt: null,
      progress: null,
      unit: "minute",
    })
    const record = await readEntry(entry.id)
    expect(record.attempts[0]?.id).toEqual(
      new Types.ObjectId(entry.attempts[0]?.id),
    )
    expect(record.attempts[0]?.isCompleted).toBe(
      status === EUserItemStatus.COMPLETED,
    )
    expect(record.attempts[0]).not.toHaveProperty("status")
  })

  it.each([false, true])(
    "возвращает 404 без создания записи для отсутствующего или удалённого Item: %s",
    async (isDeleted) => {
      const { app, connection } = getTestApplication()
      const { headers } = await createAccount()
      const itemId = isDeleted ? (await createItem())._id : new Types.ObjectId()

      if (isDeleted) {
        await connection
          .collection<Item>("Item")
          .updateOne({ _id: itemId }, { $set: { deletedAt: new Date() } })
      }

      const response = await app.inject({
        method: "POST",
        url: "/userItems",
        headers,
        payload: { itemId: itemId.toHexString(), status: "planned" },
      })

      expect(response.statusCode).toBe(404)
      expect(await connection.collection("UserItem").countDocuments()).toBe(0)
    },
  )

  it("повторное добавление возвращает 409 и сохраняет существующую запись", async () => {
    const { app } = getTestApplication()
    const { entry, item, headers } = await createEntry()
    const before = await readEntry(entry.id)
    const response = await app.inject({
      method: "POST",
      url: "/userItems",
      headers,
      payload: { itemId: item._id.toHexString(), status: "completed" },
    })

    expect(response.statusCode).toBe(409)
    expect(await readEntry(entry.id)).toEqual(before)
  })

  it("при одновременном добавлении создаёт одну запись и возвращает 409 второму запросу", async () => {
    const { app, connection } = getTestApplication()
    const { headers, user } = await createAccount()
    const item = await createItem()
    const responses = await Promise.all(
      [0, 1].map(() =>
        app.inject({
          method: "POST",
          url: "/userItems",
          headers,
          payload: { itemId: item._id.toHexString(), status: "planned" },
        }),
      ),
    )

    expect(responses.map((response) => response.statusCode).sort()).toEqual([
      201, 409,
    ])
    expect(
      await connection
        .collection<UserItem>("UserItem")
        .countDocuments({ user: user._id, item: item._id }),
    ).toBe(1)
  })

  it("позволяет разным пользователям добавить одно произведение", async () => {
    const { app, connection } = getTestApplication()
    const first = await createEntry()
    const second = await createAccount()
    const response = await app.inject({
      method: "POST",
      url: "/userItems",
      headers: second.headers,
      payload: { itemId: first.item._id.toHexString(), status: "planned" },
    })

    expect(response.statusCode).toBe(201)
    expect(response.json<UserItemResponseDto>().id).not.toBe(first.entry.id)
    expect(
      await connection
        .collection<UserItem>("UserItem")
        .countDocuments({ item: first.item._id }),
    ).toBe(2)
  })

  it("общий PATCH сохраняет все переданные поля и возвращает нормализованную запись", async () => {
    const { app } = getTestApplication()
    const { entry, headers } = await createEntry()
    const response = await app.inject({
      method: "PATCH",
      url: `/userItems/${entry.id}`,
      headers,
      payload: {
        status: "completed",
        rating: 9,
        isFavorite: true,
        note: "  Пересмотреть  ",
      },
    })

    expect(response.statusCode).toBe(200)
    expect(response.headers["cache-control"]).toBe("no-store")
    expect(response.json()).toMatchObject({
      status: "completed",
      rating: 9,
      isFavorite: true,
      note: "Пересмотреть",
      attempts: [{ isCompleted: true }],
    })
    expect(await readEntry(entry.id)).toMatchObject({
      status: "completed",
      rating: 9,
      isFavorite: true,
      note: "Пересмотреть",
      attempts: [{ isCompleted: true }],
    })
  })

  it("частичный PATCH сохраняет пропущенные поля и историю", async () => {
    const { app } = getTestApplication()
    const { entry, headers } = await createEntry(EUserItemStatus.COMPLETED)
    const prepared = await app.inject({
      method: "PATCH",
      url: `/userItems/${entry.id}`,
      headers,
      payload: { rating: 8, isFavorite: true, note: "Заметка" },
    })
    expect(prepared.statusCode).toBe(200)
    const before = await readEntry(entry.id)
    expect(before).toMatchObject({
      rating: 8,
      isFavorite: true,
      note: "Заметка",
    })
    const response = await app.inject({
      method: "PATCH",
      url: `/userItems/${entry.id}`,
      headers,
      payload: { rating: 9 },
    })

    expect(response.statusCode).toBe(200)
    expect(await readEntry(entry.id)).toMatchObject({
      rating: 9,
      status: before.status,
      isFavorite: before.isFavorite,
      note: before.note,
      attempts: before.attempts,
    })
  })

  it.each([
    { path: "rating", payload: { rating: null }, expected: { rating: null } },
    {
      path: "favorite",
      payload: { isFavorite: false },
      expected: { isFavorite: false },
    },
    { path: "note", payload: { note: null }, expected: { note: null } },
    { path: "note", payload: { note: "   " }, expected: { note: null } },
  ])(
    "PATCH /userItems/:id очищает $path без изменения остальных данных",
    async ({ payload, expected }) => {
      const { app } = getTestApplication()
      const { entry, headers } = await createEntry()
      const prepared = await app.inject({
        method: "PATCH",
        url: `/userItems/${entry.id}`,
        headers,
        payload: { rating: 8, isFavorite: true, note: "Заметка" },
      })
      expect(prepared.statusCode).toBe(200)
      expect(await readEntry(entry.id)).toMatchObject({
        rating: 8,
        isFavorite: true,
        note: "Заметка",
      })
      const response = await app.inject({
        method: "PATCH",
        url: `/userItems/${entry.id}`,
        headers,
        payload,
      })

      expect(response.statusCode).toBe(200)
      expect(await readEntry(entry.id)).toMatchObject({
        status: "planned",
        rating: 8,
        isFavorite: true,
        note: "Заметка",
        attempts: [],
        ...expected,
      })
    },
  )

  it("повтор установки избранного не переключает значение обратно", async () => {
    const { app } = getTestApplication()
    const { entry, headers } = await createEntry()

    for (const isFavorite of [true, true]) {
      const response = await app.inject({
        method: "PATCH",
        url: `/userItems/${entry.id}`,
        headers,
        payload: { isFavorite },
      })
      expect(response.statusCode).toBe(200)
      expect(await readEntry(entry.id)).toMatchObject({ isFavorite: true })
    }

    expect(await readEntry(entry.id)).toMatchObject({ isFavorite: true })
  })

  it("создаёт первую попытку при смене статуса и отмечает её завершённой без выдуманных дат", async () => {
    const { app } = getTestApplication()
    const { entry, headers } = await createEntry()
    let attemptId: string | undefined
    for (const status of [
      "inProgress",
      "onHold",
      "inProgress",
      "completed",
      "completed",
    ]) {
      const response = await app.inject({
        method: "PATCH",
        url: "/userItems/" + entry.id,
        headers,
        payload: { status },
      })
      expect(response.statusCode).toBe(200)
      const result = response.json<UserItemResponseDto>()
      expect(result.status).toBe(status)
      expect(result.attempts).toHaveLength(1)
      attemptId = attemptId ?? result.attempts[0]?.id
      expect(result.attempts[0]).toEqual({
        id: attemptId,
        isCompleted: status === "completed",
        progress: null,
        unit: "minute",
        startedAt: null,
        completedAt: null,
      })
      expect((await readEntry(entry.id)).attempts[0]).toMatchObject({
        id: new Types.ObjectId(attemptId),
        isCompleted: status === "completed",
        startedAt: null,
        completedAt: null,
      })
    }
  })

  it.each(["planned", "blocked"])(
    "переход в %s сохраняет личные данные и попытки, но запрещает новые",
    async (status) => {
      const { app } = getTestApplication()
      const { entry, headers } = await createEntry(EUserItemStatus.COMPLETED)
      const prepared = await app.inject({
        method: "PATCH",
        url: "/userItems/" + entry.id,
        headers,
        payload: { rating: 10, isFavorite: true, note: "Сохранить" },
      })
      expect(prepared.statusCode).toBe(200)
      const before = await readEntry(entry.id)
      const changed = await app.inject({
        method: "PATCH",
        url: "/userItems/" + entry.id,
        headers,
        payload: { status },
      })
      expect(changed.statusCode).toBe(200)
      expect(await readEntry(entry.id)).toMatchObject({
        status,
        expiresAt: null,
        rating: 10,
        isFavorite: true,
        note: "Сохранить",
        attempts: before.attempts,
      })
      const beforeAttempt = await readEntry(entry.id)
      const rejected = await app.inject({
        method: "POST",
        url: "/userItems/" + entry.id + "/attempts",
        headers,
        payload: {},
      })
      expect(rejected.statusCode).toBe(409)
      expect(await readEntry(entry.id)).toEqual(beforeAttempt)
      const edited = await app.inject({
        method: "PATCH",
        url: "/userItems/" + entry.id + "/attempts/" + entry.attempts[0]?.id,
        headers,
        payload: { progress: 80 },
      })
      expect(edited.statusCode).toBe(200)
      expect(await readEntry(entry.id)).toMatchObject({
        status,
        attempts: [{ isCompleted: true, progress: 80 }],
      })
    },
  )

  it("смена статуса не создаёт повторную попытку автоматически, а POST добавляет её без потери истории", async () => {
    const { app } = getTestApplication()
    const { entry, headers } = await createEntry(EUserItemStatus.COMPLETED)
    const before = await readEntry(entry.id)
    const changed = await app.inject({
      method: "PATCH",
      url: "/userItems/" + entry.id,
      headers,
      payload: { status: "inProgress" },
    })
    expect(changed.statusCode).toBe(200)
    expect((await readEntry(entry.id)).attempts).toEqual(before.attempts)
    const added = await app.inject({
      method: "POST",
      url: "/userItems/" + entry.id + "/attempts",
      headers,
      payload: {},
    })
    expect(added.statusCode).toBe(201)
    const result = added.json<UserItemResponseDto>()
    expect(result.status).toBe("inProgress")
    expect(result.attempts).toHaveLength(2)
    expect(result.attempts[0]).toEqual(entry.attempts[0])
    expect(result.attempts[1]).toMatchObject({
      isCompleted: false,
      progress: null,
      startedAt: null,
      completedAt: null,
    })
    const completed = await app.inject({
      method: "PATCH",
      url: "/userItems/" + entry.id,
      headers,
      payload: { status: "completed" },
    })
    expect(completed.statusCode).toBe(200)
    expect(
      completed
        .json<UserItemResponseDto>()
        .attempts.map((attempt) => attempt.isCompleted),
    ).toEqual([true, true])
  })

  it("конфликт skipped откатывает весь PATCH, включая оценку и заметку", async () => {
    const { app } = getTestApplication()
    const { entry, headers } = await createEntry(EUserItemStatus.IN_PROGRESS)
    const before = await readEntry(entry.id)
    const response = await app.inject({
      method: "PATCH",
      url: "/userItems/" + entry.id,
      headers,
      payload: { status: "skipped", rating: 10, note: "Изменение" },
    })
    expect(response.statusCode).toBe(409)
    expect(await readEntry(entry.id)).toEqual(before)
  })

  it.each([
    {},
    { rating: 11, note: "Изменение" },
    { status: null, isFavorite: true },
    { isFavorite: null },
    { itemId: new Types.ObjectId().toHexString() },
    { attempts: [] },
  ])("отклоняет общий PATCH без изменения MongoDB: %j", async (payload) => {
    const { app } = getTestApplication()
    const { entry, headers } = await createEntry()
    const before = await readEntry(entry.id)
    const response = await app.inject({
      method: "PATCH",
      url: `/userItems/${entry.id}`,
      headers,
      payload,
    })

    expect(response.statusCode).toBe(400)
    expect(await readEntry(entry.id)).toEqual(before)
  })

  it("добавляет прошлую попытку с датами, сохраняя общий статус и прежнюю историю", async () => {
    const { app } = getTestApplication()
    const { entry, headers } = await createEntry(EUserItemStatus.IN_PROGRESS)
    const before = await readEntry(entry.id)
    const response = await app.inject({
      method: "POST",
      url: "/userItems/" + entry.id + "/attempts",
      headers,
      payload: {
        isCompleted: true,
        progress: 90,
        startedAt: "2026-01-01T10:00:00.000Z",
        completedAt: "2026-01-01T11:30:00.000Z",
      },
    })
    expect(response.statusCode).toBe(201)
    const record = await readEntry(entry.id)
    expect(record.status).toBe("inProgress")
    expect(record.attempts).toHaveLength(2)
    expect(record.attempts[0]).toEqual(before.attempts[0])
    expect(record.attempts[1]).toMatchObject({
      id: expect.any(Types.ObjectId),
      isCompleted: true,
      progress: 90,
      unit: "minute",
      startedAt: new Date("2026-01-01T10:00:00.000Z"),
      completedAt: new Date("2026-01-01T11:30:00.000Z"),
    })
  })

  it("редактирует прогресс и полный просмотр по стабильному ID без смены общего статуса", async () => {
    const { app } = getTestApplication()
    const { entry, headers } = await createEntry(EUserItemStatus.IN_PROGRESS)
    const url = "/userItems/" + entry.id + "/attempts/" + entry.attempts[0]?.id
    for (const payload of [
      { progress: 45 },
      { progress: 100, unit: "percent", isCompleted: true },
      {
        progress: null,
        isCompleted: false,
        startedAt: null,
        completedAt: null,
      },
    ]) {
      const response = await app.inject({
        method: "PATCH",
        url,
        headers,
        payload,
      })
      expect(response.statusCode).toBe(200)
      expect(response.json<UserItemResponseDto>().status).toBe("inProgress")
      expect(response.json<UserItemResponseDto>().attempts[0]).toMatchObject({
        id: entry.attempts[0]?.id,
        ...payload,
      })
      expect((await readEntry(entry.id)).attempts[0]).toMatchObject({
        id: new Types.ObjectId(entry.attempts[0]?.id),
        ...payload,
      })
    }
  })

  it.each([0, 100])(
    "сохраняет граничный прогресс %i процентов без автоматического полного просмотра",
    async (progress) => {
      const { app } = getTestApplication()
      const { entry, headers } = await createEntry(EUserItemStatus.ON_HOLD)
      const response = await app.inject({
        method: "POST",
        url: "/userItems/" + entry.id + "/attempts",
        headers,
        payload: { unit: "percent", progress },
      })
      expect(response.statusCode).toBe(201)
      expect((await readEntry(entry.id)).attempts.at(-1)).toMatchObject({
        unit: "percent",
        progress,
        isCompleted: false,
        startedAt: null,
        completedAt: null,
      })
    },
  )

  it.each([
    { unit: "percent", progress: 101 },
    { unit: "percent", progress: -1 },
    { unit: "percent", progress: 0.5 },
    { progress: Number.MAX_SAFE_INTEGER + 1 },
    {
      startedAt: "2026-02-01T00:00:00.000Z",
      completedAt: "2026-01-01T00:00:00.000Z",
    },
    { isCompleted: null },
    { status: "completed" },
  ])(
    "отклоняет некорректное создание попытки без изменения записи: %j",
    async (payload) => {
      const { app } = getTestApplication()
      const { entry, headers } = await createEntry(EUserItemStatus.IN_PROGRESS)
      const before = await readEntry(entry.id)
      const response = await app.inject({
        method: "POST",
        url: "/userItems/" + entry.id + "/attempts",
        headers,
        payload,
      })
      expect(response.statusCode).toBe(400)
      expect(await readEntry(entry.id)).toEqual(before)
    },
  )

  it.each([{}, { startedAt: "2026-02-01T00:00:00.000Z", progress: 30 }])(
    "отклоняет пустой или несогласованный PATCH попытки без частичного сохранения: %j",
    async (payload) => {
      const { app } = getTestApplication()
      const { entry, headers } = await createEntry(EUserItemStatus.COMPLETED)
      const url =
        "/userItems/" + entry.id + "/attempts/" + entry.attempts[0]?.id
      const prepared = await app.inject({
        method: "PATCH",
        url,
        headers,
        payload: { completedAt: "2026-01-01T00:00:00.000Z" },
      })
      expect(prepared.statusCode).toBe(200)
      const before = await readEntry(entry.id)
      const response = await app.inject({
        method: "PATCH",
        url,
        headers,
        payload,
      })
      expect(response.statusCode).toBe(400)
      expect(await readEntry(entry.id)).toEqual(before)
    },
  )

  it("проверяет итоговые unit и progress при частичной смене единицы", async () => {
    const { app } = getTestApplication()
    const { entry, headers } = await createEntry(EUserItemStatus.IN_PROGRESS)
    const url = "/userItems/" + entry.id + "/attempts/" + entry.attempts[0]?.id
    const prepared = await app.inject({
      method: "PATCH",
      url,
      headers,
      payload: { progress: 120 },
    })
    expect(prepared.statusCode).toBe(200)
    const before = await readEntry(entry.id)
    const rejected = await app.inject({
      method: "PATCH",
      url,
      headers,
      payload: { unit: "percent" },
    })
    expect(rejected.statusCode).toBe(400)
    expect(await readEntry(entry.id)).toEqual(before)
    const accepted = await app.inject({
      method: "PATCH",
      url,
      headers,
      payload: { unit: "percent", progress: 100 },
    })
    expect(accepted.statusCode).toBe(200)
    const invalidProgress = await app.inject({
      method: "PATCH",
      url,
      headers,
      payload: { progress: 101 },
    })
    expect(invalidProgress.statusCode).toBe(400)
    expect((await readEntry(entry.id)).attempts[0]).toMatchObject({
      unit: "percent",
      progress: 100,
    })
  })

  it("параллельные добавления попыток сохраняются без потери истории", async () => {
    const { app } = getTestApplication()
    const { entry, headers } = await createEntry(EUserItemStatus.IN_PROGRESS)
    const before = await readEntry(entry.id)
    synchronizeMutationReads(2)
    const responses = await Promise.all(
      [10, 20].map((progress) =>
        app.inject({
          method: "POST",
          url: "/userItems/" + entry.id + "/attempts",
          headers,
          payload: { progress },
        }),
      ),
    )
    expect(responses.map((response) => response.statusCode)).toEqual([201, 201])
    const record = await readEntry(entry.id)
    expect(record.status).toBe("inProgress")
    expect(record.attempts).toHaveLength(3)
    expect(record.attempts[0]).toEqual(before.attempts[0])
    expect(record.attempts.slice(1)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ progress: 10 }),
        expect.objectContaining({ progress: 20 }),
      ]),
    )
  })

  it("параллельные исторические попытки и изменения полей не теряются", async () => {
    const { app } = getTestApplication()
    const { entry, headers } = await createEntry(EUserItemStatus.IN_PROGRESS)
    synchronizeMutationReads(4)
    const url = "/userItems/" + entry.id
    const responses = await Promise.all([
      app.inject({
        method: "POST",
        url: url + "/attempts",
        headers,
        payload: { isCompleted: true, progress: 90 },
      }),
      app.inject({
        method: "POST",
        url: url + "/attempts",
        headers,
        payload: { isCompleted: false, progress: 30 },
      }),
      app.inject({ method: "PATCH", url, headers, payload: { rating: 8 } }),
      app.inject({
        method: "PATCH",
        url,
        headers,
        payload: { isFavorite: true },
      }),
    ])
    expect(responses.map((response) => response.statusCode).sort()).toEqual([
      200, 200, 201, 201,
    ])
    const record = await readEntry(entry.id)
    expect(record).toMatchObject({
      status: "inProgress",
      rating: 8,
      isFavorite: true,
    })
    expect(record.attempts).toHaveLength(3)
    expect(record.attempts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ isCompleted: true, progress: 90 }),
        expect.objectContaining({ isCompleted: false, progress: 30 }),
      ]),
    )
  })

  it.each([
    { method: "DELETE", path: "" },
    { method: "PATCH", path: "", payload: { status: "completed" } },
    { method: "PATCH", path: "", payload: { isFavorite: true } },
    { method: "PATCH", path: "", payload: { rating: 9 } },
    { method: "PATCH", path: "", payload: { note: "Заметка" } },
    { method: "POST", path: "/attempts", payload: { isCompleted: true } },
    { method: "PATCH", path: "/attempts/current", payload: { progress: 10 } },
  ] as const)(
    "возвращает 404 без изменения чужой записи для $method $path",
    async ({ method, path, ...request }) => {
      const { app } = getTestApplication()
      const { entry } = await createEntry(EUserItemStatus.IN_PROGRESS)
      const other = await createAccount()
      const before = await readEntry(entry.id)
      const actualPath =
        path === "/attempts/current"
          ? `/attempts/${entry.attempts[0]?.id}`
          : path
      const response = await app.inject({
        method,
        url: `/userItems/${entry.id}${actualPath}`,
        headers: other.headers,
        ...request,
      })

      expect(response.statusCode).toBe(404)
      expect(await readEntry(entry.id)).toEqual(before)
    },
  )

  it.each(["none", "invalid", "expired", "revoked", "deletedUser"] as const)(
    "отклоняет изменение при недействительной авторизации: %s",
    async (kind) => {
      const { app, connection } = getTestApplication()
      const { entry, headers, session, user } = await createEntry()
      const before = await readEntry(entry.id)

      if (kind === "expired") {
        await connection
          .collection<Session>("Session")
          .updateOne(
            { _id: session._id },
            { $set: { expiresAt: new Date(Date.now() - 1000) } },
          )
      } else if (kind === "revoked") {
        await connection
          .collection<Session>("Session")
          .deleteOne({ _id: session._id })
      } else if (kind === "deletedUser") {
        await connection.collection<User>("User").deleteOne({ _id: user._id })
      }

      const requestHeaders =
        kind === "none"
          ? { origin: "http://localhost" }
          : kind === "invalid"
            ? { ...headers, cookie: "__Host-accessToken=invalid" }
            : headers
      const response = await app.inject({
        method: "PATCH",
        url: `/userItems/${entry.id}`,
        headers: requestHeaders,
        payload: { rating: 9 },
      })

      expect(response.statusCode).toBe(401)
      expect(await readEntry(entry.id)).toEqual(before)
    },
  )

  it("отклоняет посторонний Origin без изменения MongoDB", async () => {
    const { app } = getTestApplication()
    const { entry, headers } = await createEntry()
    const before = await readEntry(entry.id)
    const response = await app.inject({
      method: "PATCH",
      url: `/userItems/${entry.id}`,
      headers: { ...headers, origin: "https://untrusted.example" },
      payload: { rating: 9 },
    })

    expect(response.statusCode).toBe(403)
    expect(await readEntry(entry.id)).toEqual(before)
  })

  it("возвращает 404 для отсутствующей записи и попытки без создания новых данных", async () => {
    const { app } = getTestApplication()
    const { entry, headers } = await createEntry()
    const before = await readEntry(entry.id)
    const missing = new Types.ObjectId().toHexString()
    const missingEntry = await app.inject({
      method: "PATCH",
      url: `/userItems/${missing}`,
      headers,
      payload: { rating: 9 },
    })
    const missingAttempt = await app.inject({
      method: "PATCH",
      url: `/userItems/${entry.id}/attempts/${missing}`,
      headers,
      payload: { progress: 1 },
    })

    expect(missingEntry.statusCode).toBe(404)
    expect(missingAttempt.statusCode).toBe(404)
    expect(await readEntry(entry.id)).toEqual(before)
  })

  it("сохраняет доступ к существующей библиотеке после мягкого удаления Item", async () => {
    const { app, connection } = getTestApplication()
    const { entry, item, headers } = await createEntry()
    await connection
      .collection<Item>("Item")
      .updateOne({ _id: item._id }, { $set: { deletedAt: new Date() } })
    const response = await app.inject({
      method: "PATCH",
      url: `/userItems/${entry.id}`,
      headers,
      payload: { rating: 9 },
    })

    expect(response.statusCode).toBe(200)
    expect(await readEntry(entry.id)).toMatchObject({ rating: 9 })
  })

  it("удаляет всю запись с попытками, оставляя Item, пользователя и сессию", async () => {
    const { app, connection } = getTestApplication()
    const { entry, item, user, session, headers } = await createEntry(
      EUserItemStatus.COMPLETED,
    )
    const response = await app.inject({
      method: "DELETE",
      url: `/userItems/${entry.id}`,
      headers,
    })

    expect(response.statusCode).toBe(204)
    expect(response.body).toBe("")
    expect(response.headers["cache-control"]).toBe("no-store")
    expect(
      await connection
        .collection<UserItem>("UserItem")
        .findOne({ _id: new Types.ObjectId(entry.id) }),
    ).toBeNull()
    expect(
      await connection
        .collection<Item>("Item")
        .countDocuments({ _id: item._id }),
    ).toBe(1)
    expect(
      await connection
        .collection<User>("User")
        .countDocuments({ _id: user._id }),
    ).toBe(1)
    expect(
      await connection
        .collection<Session>("Session")
        .countDocuments({ _id: session._id }),
    ).toBe(1)
    const repeated = await app.inject({
      method: "DELETE",
      url: `/userItems/${entry.id}`,
      headers,
    })
    expect(repeated.statusCode).toBe(404)
  })
  it.each(["skip", "block"])(
    "создаёт %s с пустыми личными данными и корректным сроком",
    async (operation) => {
      const { app } = getTestApplication()
      const { headers } = await createAccount()
      const item = await createItem()
      const before = Date.now()
      const response = await app.inject({
        method: "POST",
        url: "/userItems/" + operation,
        headers,
        payload: { itemId: item._id.toHexString() },
      })
      const after = Date.now()
      expect(response.statusCode).toBe(201)
      expect(response.headers["cache-control"]).toBe("no-store")
      const entry = response.json<UserItemResponseDto>()
      expect(entry).toMatchObject({
        itemId: item._id.toHexString(),
        status: operation === "skip" ? "skipped" : "blocked",
        rating: null,
        isFavorite: false,
        note: null,
        attempts: [],
      })
      const record = await readEntry(entry.id)
      expect(record.status).toBe(entry.status)
      if (operation === "skip") {
        const duration = 90 * 24 * 60 * 60 * 1000
        const expiry = new Date(entry.expiresAt ?? "").getTime()
        expect(expiry).toBeGreaterThanOrEqual(before + duration)
        expect(expiry).toBeLessThanOrEqual(after + duration)
        expect(record.expiresAt).toEqual(new Date(expiry))
      } else {
        expect(entry.expiresAt).toBeNull()
        expect(record.expiresAt).toBeNull()
      }
      const removed = await app.inject({
        method: "DELETE",
        url: "/userItems/" + entry.id,
        headers,
      })
      expect(removed.statusCode).toBe(204)
      expect(
        await getTestApplication()
          .connection.collection("UserItem")
          .countDocuments(),
      ).toBe(0)
    },
  )

  it.each(["skip", "block"])(
    "не заменяет библиотечную запись через %s",
    async (operation) => {
      const { app } = getTestApplication()
      const { entry, item, headers } = await createEntry(
        EUserItemStatus.COMPLETED,
      )
      const before = await readEntry(entry.id)
      const response = await app.inject({
        method: "POST",
        url: "/userItems/" + operation,
        headers,
        payload: { itemId: item._id.toHexString() },
      })
      expect(response.statusCode).toBe(409)
      expect(await readEntry(entry.id)).toEqual(before)
    },
  )

  it.each(["skip", "block"])(
    "повтор %s и обычный POST не заменяют существующее исключение",
    async (operation) => {
      const { app } = getTestApplication()
      const { headers } = await createAccount()
      const item = await createItem()
      const created = await app.inject({
        method: "POST",
        url: "/userItems/" + operation,
        headers,
        payload: { itemId: item._id.toHexString() },
      })
      expect(created.statusCode).toBe(201)
      const entry = created.json<UserItemResponseDto>()
      const before = await readEntry(entry.id)
      for (const target of [
        "/userItems/skip",
        "/userItems/block",
        "/userItems",
      ]) {
        const response = await app.inject({
          method: "POST",
          url: target,
          headers,
          payload:
            target === "/userItems"
              ? { itemId: item._id.toHexString(), status: "planned" }
              : { itemId: item._id.toHexString() },
        })
        expect(response.statusCode).toBe(409)
        expect(await readEntry(entry.id)).toEqual(before)
      }
    },
  )

  it("одновременные skip и block создают одну личную запись", async () => {
    const { app, connection } = getTestApplication()
    const { headers, user } = await createAccount()
    const item = await createItem()
    const responses = await Promise.all(
      ["skip", "block"].map((operation) =>
        app.inject({
          method: "POST",
          url: "/userItems/" + operation,
          headers,
          payload: { itemId: item._id.toHexString() },
        }),
      ),
    )
    expect(responses.map((response) => response.statusCode).sort()).toEqual([
      201, 409,
    ])
    expect(
      await connection
        .collection("UserItem")
        .countDocuments({ user: user._id, item: item._id }),
    ).toBe(1)
  })

  it.each([{ rating: 8 }, { isFavorite: true }, { note: "Заметка" }])(
    "не допускает skipped при наличии личных данных: %j",
    async (payload) => {
      const { app } = getTestApplication()
      const { entry, headers } = await createEntry()
      const url = "/userItems/" + entry.id
      expect(
        (await app.inject({ method: "PATCH", url, headers, payload }))
          .statusCode,
      ).toBe(200)
      const before = await readEntry(entry.id)
      const response = await app.inject({
        method: "PATCH",
        url,
        headers,
        payload: { status: "skipped" },
      })
      expect(response.statusCode).toBe(409)
      expect(await readEntry(entry.id)).toEqual(before)
    },
  )

  it("очистка личных полей и переход в skipped выполняются атомарно", async () => {
    const { app } = getTestApplication()
    const { entry, headers } = await createEntry()
    const url = "/userItems/" + entry.id
    expect(
      (
        await app.inject({
          method: "PATCH",
          url,
          headers,
          payload: { rating: 8, isFavorite: true, note: "Заметка" },
        })
      ).statusCode,
    ).toBe(200)
    const response = await app.inject({
      method: "PATCH",
      url,
      headers,
      payload: {
        status: "skipped",
        rating: null,
        isFavorite: false,
        note: null,
      },
    })
    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      status: "skipped",
      rating: null,
      isFavorite: false,
      note: null,
      attempts: [],
      expiresAt: expect.any(String),
    })
    for (const payload of [
      { rating: 8 },
      { isFavorite: true },
      { note: "Заметка" },
    ]) {
      const before = await readEntry(entry.id)
      const rejected = await app.inject({
        method: "PATCH",
        url,
        headers,
        payload,
      })
      expect(rejected.statusCode).toBe(409)
      expect(await readEntry(entry.id)).toEqual(before)
    }
    const rejectedAttempt = await app.inject({
      method: "POST",
      url: url + "/attempts",
      headers,
      payload: {},
    })
    expect(rejectedAttempt.statusCode).toBe(409)
  })

  it("повтор skipped сохраняет срок, а выход из него очищает expiresAt", async () => {
    const { app } = getTestApplication()
    const { entry, headers } = await createEntry()
    const url = "/userItems/" + entry.id
    const first = await app.inject({
      method: "PATCH",
      url,
      headers,
      payload: { status: "skipped" },
    })
    expect(first.statusCode).toBe(200)
    const deadline = first.json<UserItemResponseDto>().expiresAt
    const repeated = await app.inject({
      method: "PATCH",
      url,
      headers,
      payload: { status: "skipped" },
    })
    expect(repeated.statusCode).toBe(200)
    expect(repeated.json<UserItemResponseDto>().expiresAt).toBe(deadline)
    const blocked = await app.inject({
      method: "PATCH",
      url,
      headers,
      payload: { status: "blocked" },
    })
    expect(blocked.statusCode).toBe(200)
    expect((await readEntry(entry.id)).expiresAt).toBeNull()
    const library = await app.inject({
      method: "PATCH",
      url,
      headers,
      payload: { status: "inProgress" },
    })
    expect(library.statusCode).toBe(200)
    expect(library.json()).toMatchObject({
      expiresAt: null,
      status: "inProgress",
      attempts: [{ isCompleted: false }],
    })
  })

  it("просроченный skipped нельзя редактировать, но он не мешает новому добавлению", async () => {
    const { app, connection } = getTestApplication()
    const { entry, item, headers } = await createEntry()
    await connection
      .collection("UserItem")
      .updateOne(
        { _id: new Types.ObjectId(entry.id) },
        { $set: { status: "skipped", expiresAt: new Date(Date.now() - 1000) } },
      )
    const expired = await app.inject({
      method: "PATCH",
      url: "/userItems/" + entry.id,
      headers,
      payload: { status: "planned" },
    })
    expect(expired.statusCode).toBe(404)
    const fresh = await app.inject({
      method: "POST",
      url: "/userItems",
      headers,
      payload: { itemId: item._id.toHexString(), status: "planned" },
    })
    expect(fresh.statusCode).toBe(201)
    expect(fresh.json<UserItemResponseDto>().id).not.toBe(entry.id)
    expect(
      await connection
        .collection("UserItem")
        .countDocuments({ item: item._id }),
    ).toBe(1)
  })

  it.each(["skip", "block"])(
    "проверяет доступ и доступность Item для %s",
    async (operation) => {
      const { app, connection } = getTestApplication()
      const { headers } = await createAccount()
      const item = await createItem()
      const url = "/userItems/" + operation
      const payload = { itemId: item._id.toHexString() }
      const unauthenticated = await app.inject({
        method: "POST",
        url,
        headers: { origin: "http://localhost" },
        payload,
      })
      expect(unauthenticated.statusCode).toBe(401)
      const csrf = await app.inject({
        method: "POST",
        url,
        headers: { ...headers, origin: "https://untrusted.example" },
        payload,
      })
      expect(csrf.statusCode).toBe(403)
      await connection
        .collection("Item")
        .updateOne({ _id: item._id }, { $set: { deletedAt: new Date() } })
      for (const itemId of [
        item._id.toHexString(),
        new Types.ObjectId().toHexString(),
      ]) {
        const missing = await app.inject({
          method: "POST",
          url,
          headers,
          payload: { itemId },
        })
        expect(missing.statusCode).toBe(404)
      }
      expect(await connection.collection("UserItem").countDocuments()).toBe(0)
    },
  )

  it("TTL удаляет только просроченный skipped и сохраняет blocked и библиотечную запись", async () => {
    const { connection } = getTestApplication()
    const { entry, user } = await createEntry()
    const expired = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const skipId = new Types.ObjectId()
    const blockId = new Types.ObjectId()
    const futureId = new Types.ObjectId()
    await connection.collection("UserItem").insertMany([
      {
        _id: skipId,
        user: user._id,
        item: new Types.ObjectId(),
        status: "skipped",
        expiresAt: expired,
        rating: null,
        isFavorite: false,
        note: null,
        attempts: [],
      },
      {
        _id: blockId,
        user: user._id,
        item: new Types.ObjectId(),
        status: "blocked",
        expiresAt: expired,
      },
      {
        _id: futureId,
        user: user._id,
        item: new Types.ObjectId(),
        status: "skipped",
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      },
    ])
    await connection
      .collection("UserItem")
      .updateOne(
        { _id: new Types.ObjectId(entry.id) },
        { $set: { expiresAt: expired } },
      )
    const indexes = await connection.collection("UserItem").indexes()
    expect(indexes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "userItemSkippedExpiry",
          key: { expiresAt: 1 },
          expireAfterSeconds: 0,
          partialFilterExpression: { status: "skipped" },
        }),
      ]),
    )
    const deadline = Date.now() + 120_000
    while (
      (await connection
        .collection("UserItem")
        .countDocuments({ _id: skipId })) > 0 &&
      Date.now() < deadline
    ) {
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
    expect(
      await connection.collection("UserItem").findOne({ _id: skipId }),
    ).toBeNull()
    expect(
      await connection.collection("UserItem").countDocuments({
        _id: { $in: [blockId, futureId, new Types.ObjectId(entry.id)] },
      }),
    ).toBe(3)
  }, 150_000)

  it("читает только краткие собственные записи по ID UserItem в порядке запроса", async () => {
    const { connection } = getTestApplication()
    const owner = await createEntry(EUserItemStatus.IN_PROGRESS)
    const foreign = await createEntry()
    const otherItem = await createItem()
    const second = await getFastify().inject({
      method: "POST",
      url: "/userItems",
      headers: owner.headers,
      payload: { itemId: otherItem._id.toHexString(), status: "planned" },
    })
    expect(second.statusCode).toBe(201)
    const secondEntry = second.json<UserItemResponseDto>()
    const updated = await getFastify().inject({
      method: "PATCH",
      url: "/userItems/" + owner.entry.id,
      headers: owner.headers,
      payload: { rating: 8, isFavorite: true, note: "Приватная заметка" },
    })
    expect(updated.statusCode).toBe(200)
    await connection
      .collection("Item")
      .updateOne({ _id: owner.item._id }, { $set: { deletedAt: new Date() } })
    const before = await readEntry(owner.entry.id)
    const response = await getFastify().inject({
      method: "QUERY",
      url: "/userItems",
      headers: owner.headers,
      payload: {
        ids: [
          secondEntry.id,
          foreign.entry.id,
          new Types.ObjectId().toHexString(),
          owner.item._id.toHexString(),
          owner.entry.id.toUpperCase(),
        ],
      },
    })
    expect(response.statusCode).toBe(200)
    expect(response.headers["cache-control"]).toBe("no-store")
    expect(response.headers["accept-query"]).toBe("application/json")
    expect(response.json()).toEqual([
      {
        id: secondEntry.id,
        itemId: otherItem._id.toHexString(),
        rating: null,
        isFavorite: false,
        status: "planned",
      },
      {
        id: owner.entry.id,
        itemId: owner.item._id.toHexString(),
        rating: 8,
        isFavorite: true,
        status: "inProgress",
      },
    ])
    expect(await readEntry(owner.entry.id)).toEqual(before)
  })

  it("не возвращает просроченный skipped, сохраняя активный skipped и бессрочный blocked", async () => {
    const { connection } = getTestApplication()
    const owner = await createAccount()
    const entries: UserItemResponseDto[] = []
    for (const operation of ["skip", "skip", "block"]) {
      const item = await createItem()
      const response = await getFastify().inject({
        method: "POST",
        url: "/userItems/" + operation,
        headers: owner.headers,
        payload: { itemId: item._id.toHexString() },
      })
      expect(response.statusCode).toBe(201)
      entries.push(response.json<UserItemResponseDto>())
    }
    const [expired, active, blocked] = entries
    expect(expired).toBeDefined()
    await connection
      .collection("UserItem")
      .updateOne(
        { _id: new Types.ObjectId(expired?.id) },
        { $set: { expiresAt: new Date(Date.now() - 1000) } },
      )
    const response = await getFastify().inject({
      method: "QUERY",
      url: "/userItems",
      headers: owner.headers,
      payload: { ids: entries.map((entry) => entry.id) },
    })
    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual(
      [active, blocked].map((entry) => ({
        id: entry?.id,
        itemId: entry?.itemId,
        rating: null,
        isFavorite: false,
        status: entry?.status,
      })),
    )
  })

  it.each(["missing", "invalid", "expired", "revoked", "missingUser"])(
    "не разрешает QUERY при недействительной авторизации %s",
    async (state) => {
      const { connection } = getTestApplication()
      const owner = await createEntry()
      if (state === "expired") {
        await connection
          .collection("Session")
          .updateOne(
            { _id: owner.session._id },
            { $set: { expiresAt: new Date(Date.now() - 1000) } },
          )
      }
      if (state === "revoked") {
        await connection
          .collection("Session")
          .deleteOne({ _id: owner.session._id })
      }
      if (state === "missingUser") {
        await connection.collection("User").deleteOne({ _id: owner.user._id })
      }
      const headers =
        state === "missing"
          ? {}
          : state === "invalid"
            ? { cookie: "__Host-accessToken=invalid" }
            : owner.headers
      const response = await getFastify().inject({
        method: "QUERY",
        url: "/userItems",
        headers,
        payload: { ids: [owner.entry.id] },
      })
      expect(response.statusCode).toBe(401)
    },
  )

  it("возвращает пустой массив для недоступных ID и не создаёт личных записей", async () => {
    const { connection } = getTestApplication()
    const owner = await createAccount()
    const response = await getFastify().inject({
      method: "QUERY",
      url: "/userItems",
      headers: owner.headers,
      payload: {
        ids: Array.from({ length: 60 }, () =>
          new Types.ObjectId().toHexString(),
        ),
      },
    })
    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual([])
    expect(await connection.collection("UserItem").countDocuments()).toBe(0)
  })

  it("разрешает CORS preflight для QUERY и сохраняет проверку доверенного origin", async () => {
    const owner = await createEntry()
    const preflight = await getFastify().inject({
      method: "OPTIONS",
      url: "/userItems",
      headers: {
        origin: "http://localhost",
        "access-control-request-method": "QUERY",
        "access-control-request-headers": "content-type",
      },
    })
    expect(preflight.statusCode).toBe(204)
    expect(
      preflight.headers["access-control-allow-methods"]
        ?.split(",")
        .map((method) => method.trim()),
    ).toContain("QUERY")
    expect(preflight.headers["access-control-allow-credentials"]).toBe("true")
    for (const [origin, status] of [
      ["http://localhost", 200],
      ["https://untrusted.example", 403],
    ] satisfies Array<[string, number]>) {
      const response = await getFastify().inject({
        method: "QUERY",
        url: "/userItems",
        headers: { ...owner.headers, origin, "sec-fetch-site": "cross-site" },
        payload: { ids: [owner.entry.id] },
      })
      expect(response.statusCode).toBe(status)
    }
  })
})
