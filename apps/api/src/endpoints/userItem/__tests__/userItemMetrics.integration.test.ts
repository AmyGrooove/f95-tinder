import { describe, expect, it, jest } from "@jest/globals"
import { mongo, Types } from "mongoose"

import { createAccount as registerAccount } from "@endpoints/account/__tests__/functions/createAccount"
import { EItemType } from "@entities/item/schemas/EItemType"
import { ItemRepository } from "@entities/item/services/item.repository"
import { ItemMetricRepository } from "@entities/itemMetric/services/itemMetric.repository"
import { SiteRatingsMetricRepository } from "@entities/siteMetric/services/siteRatingsMetric.repository"
import { EUserItemStatus } from "@entities/userItem/schemas/EUserItemStatus"
import { UserTasteProfileRecalculationService } from "@entities/userTasteProfile/services/userTasteProfileRecalculation.service"
import { MongoTransactionService } from "@infrastructure/database/services/mongoTransaction.service"
import { getTestApplication } from "@test/setup/setupIntegration"

import type { UserItemResponseDto } from "../dto/response/userItem.response"

describe("UserItemMetrics MongoDB HTTP", () => {
  let clientIndex = 0
  const createAccount = async () => {
    clientIndex += 1
    return await registerAccount("anonymous", `198.18.0.${clientIndex}`)
  }
  const createItem = async () => {
    return await getTestApplication()
      .app.get(ItemRepository)
      .write.create({
        type: EItemType.MOVIE,
        title: { ru: "Метрики", en: null },
      })
  }
  const createEntry = async (
    itemId: Types.ObjectId,
    status = EUserItemStatus.PLANNED,
  ) => {
    const account = await createAccount()
    const response = await getTestApplication().app.inject({
      method: "POST",
      url: "/userItems",
      headers: account.headers,
      payload: { itemId: String(itemId), status },
    })
    expect(response.statusCode).toBe(201)
    return { ...account, entry: response.json<UserItemResponseDto>() }
  }
  const patch = async (
    owner: Awaited<ReturnType<typeof createEntry>>,
    payload: object,
  ) => {
    const response = await getTestApplication().app.inject({
      method: "PATCH",
      url: `/userItems/${owner.entry.id}`,
      headers: owner.headers,
      payload,
    })
    expect(response.statusCode).toBe(200)
    return response.json<UserItemResponseDto>()
  }
  const readItem = async (item: Types.ObjectId) => {
    return await getTestApplication()
      .connection.collection("ItemMetric")
      .findOne({ item })
  }
  const readSite = async () => {
    return await getTestApplication()
      .connection.collection("SiteMetric")
      .findOne({ key: "ratings" })
  }
  const zeroDistribution = {
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
  }

  it("обновляет сумму, количество, распределение и сохранённую среднюю при 7 → 9 → null", async () => {
    const item = await createItem()
    const owner = await createEntry(item._id)
    await patch(owner, { rating: 7 })
    expect(await readItem(item._id)).toMatchObject({
      ratingsCount: 1,
      ratingAverage: 7,
      ratingDistribution: { ...zeroDistribution, seven: 1 },
    })
    expect(await readSite()).toMatchObject({ sum: 7, count: 1, average: 7 })

    const initialItem = await readItem(item._id)
    const initialSite = await readSite()
    expect(initialItem?.createdAt).toBeInstanceOf(Date)
    expect(initialSite?.createdAt).toBeInstanceOf(Date)
    await patch(owner, { rating: 9 })
    expect((await readItem(item._id))?.createdAt).toEqual(
      initialItem?.createdAt,
    )
    expect((await readSite())?.createdAt).toEqual(initialSite?.createdAt)
    expect(await readItem(item._id)).toMatchObject({
      ratingsCount: 1,
      ratingAverage: 9,
      ratingDistribution: { ...zeroDistribution, nine: 1 },
    })
    const site = await readSite()
    expect(site).toMatchObject({
      key: "ratings",
      sum: 9,
      count: 1,
      average: 9,
      createdAt: expect.any(Date),
      updatedAt: expect.any(Date),
    })
    expect(site?._id).toBeInstanceOf(Types.ObjectId)
    expect(site).not.toHaveProperty("calculatedAt")
    expect(await readItem(item._id)).not.toHaveProperty("ratingsSum")
    expect(await readItem(item._id)).not.toHaveProperty("ratingScore")

    await patch(owner, { rating: null })
    expect(await readItem(item._id)).toMatchObject({
      ratingsCount: 0,
      ratingAverage: null,
      ratingDistribution: zeroDistribution,
    })
    expect(await readSite()).toMatchObject({ sum: 0, count: 0, average: null })
    expect(
      await getTestApplication()
        .app.get(SiteRatingsMetricRepository)
        .readRatingBaseline(),
    ).toEqual({ average: 5.5 })
  })

  it("учитывает все десять оценок, а общую среднюю взвешивает по количеству", async () => {
    const first = await createItem()
    const second = await createItem()
    for (const rating of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
      await patch(await createEntry(first._id), { rating })
    }
    await patch(await createEntry(second._id), { rating: 10 })
    expect(await readItem(first._id)).toMatchObject({
      ratingsCount: 10,
      ratingAverage: 5.5,
      ratingDistribution: {
        one: 1,
        two: 1,
        three: 1,
        four: 1,
        five: 1,
        six: 1,
        seven: 1,
        eight: 1,
        nine: 1,
        ten: 1,
      },
    })
    expect(await readItem(second._id)).toMatchObject({
      ratingsCount: 1,
      ratingAverage: 10,
    })
    expect(await readSite()).toMatchObject({
      sum: 65,
      count: 11,
      average: 65 / 11,
    })
  })

  it("обновляет все библиотечные статусы, сохраняет blocked-реакции и считает попытки без ограничения", async () => {
    const { app } = getTestApplication()
    const item = await createItem()
    const owner = await createEntry(item._id, EUserItemStatus.IN_PROGRESS)
    await patch(owner, { rating: 8, isFavorite: true })
    for (const status of [
      EUserItemStatus.ON_HOLD,
      EUserItemStatus.DROPPED,
      EUserItemStatus.COMPLETED,
    ]) {
      await patch(owner, { status })
    }
    for (let index = 0; index < 4; index += 1) {
      const response = await app.inject({
        method: "POST",
        url: `/userItems/${owner.entry.id}/attempts`,
        headers: owner.headers,
        payload: { isCompleted: true },
      })
      expect(response.statusCode).toBe(201)
    }
    const beforeSite = await readSite()
    await patch(owner, { status: EUserItemStatus.BLOCKED })
    expect(await readItem(item._id)).toMatchObject({
      ratingsCount: 1,
      ratingAverage: 8,
      favoritesCount: 1,
      completedAttemptsCount: 5,
      statusCounts: {
        planned: 0,
        inProgress: 0,
        onHold: 0,
        completed: 0,
        dropped: 0,
      },
    })
    expect(await readSite()).toEqual(beforeSite)

    const removed = await app.inject({
      method: "DELETE",
      url: `/userItems/${owner.entry.id}`,
      headers: owner.headers,
    })
    expect(removed.statusCode).toBe(204)
    expect(await readItem(item._id)).toMatchObject({
      ratingsCount: 0,
      ratingAverage: null,
      favoritesCount: 0,
      completedAttemptsCount: 0,
      ratingDistribution: zeroDistribution,
    })
    expect(await readSite()).toMatchObject({ sum: 0, count: 0, average: null })
  })

  it("не пишет агрегаты при повторной оценке, заметке, датах и прогрессе", async () => {
    const { app } = getTestApplication()
    const item = await createItem()
    const owner = await createEntry(item._id, EUserItemStatus.IN_PROGRESS)
    await patch(owner, { rating: 9 })
    const beforeItem = await readItem(item._id)
    const beforeSite = await readSite()
    const applyItem = jest.spyOn(app.get(ItemMetricRepository), "applyChanges")
    const applySite = jest.spyOn(
      app.get(SiteRatingsMetricRepository),
      "applyChanges",
    )
    await patch(owner, { rating: 9, note: "Без изменения оценки" })
    const response = await app.inject({
      method: "PATCH",
      url: `/userItems/${owner.entry.id}/attempts/${owner.entry.attempts[0]?.id}`,
      headers: owner.headers,
      payload: { progress: 7, startedAt: "2026-10-01T00:00:00Z" },
    })
    expect(response.statusCode).toBe(200)
    expect(applyItem).not.toHaveBeenCalled()
    expect(applySite).not.toHaveBeenCalled()
    expect(await readItem(item._id)).toEqual(beforeItem)
    expect(await readSite()).toEqual(beforeSite)
  })

  it.each(["skip", "block"])(
    "не создаёт агрегаты при добавлении и удалении исключения %s",
    async (operation) => {
      const { app } = getTestApplication()
      const item = await createItem()
      const account = await createAccount()
      const created = await app.inject({
        method: "POST",
        url: `/userItems/${operation}`,
        headers: account.headers,
        payload: { itemId: String(item._id) },
      })
      expect(created.statusCode).toBe(201)
      expect(await readItem(item._id)).toBeNull()
      expect(await readSite()).toBeNull()
      const removed = await app.inject({
        method: "DELETE",
        url: `/userItems/${created.json<UserItemResponseDto>().id}`,
        headers: account.headers,
      })
      expect(removed.statusCode).toBe(204)
      expect(await readItem(item._id)).toBeNull()
      expect(await readSite()).toBeNull()
    },
  )

  it.each(["create", "update", "delete"] as const)(
    "откатывает UserItem и ItemMetric при ошибке метрик во время %s",
    async (operation) => {
      const { app, connection } = getTestApplication()
      const item = await createItem()
      const owner = await createEntry(item._id)
      if (operation !== "create") {
        await patch(owner, { rating: 7 })
      }
      const target = operation === "create" ? await createItem() : item
      const beforeUser = await connection
        .collection("UserItem")
        .findOne({ _id: new Types.ObjectId(owner.entry.id) })
      const beforeItem = await readItem(target._id)
      const beforeSite = await readSite()
      const taste = jest.spyOn(
        app.get(UserTasteProfileRecalculationService),
        "enqueue",
      )
      if (operation === "create") {
        jest
          .spyOn(app.get(ItemMetricRepository), "applyChanges")
          .mockRejectedValueOnce(new Error("ItemMetric unavailable"))
      } else {
        jest
          .spyOn(app.get(SiteRatingsMetricRepository), "applyChanges")
          .mockRejectedValueOnce(new Error("SiteMetric unavailable"))
      }
      const response = await app.inject({
        method:
          operation === "create"
            ? "POST"
            : operation === "delete"
              ? "DELETE"
              : "PATCH",
        url:
          operation === "create"
            ? "/userItems"
            : `/userItems/${owner.entry.id}`,
        headers: owner.headers,
        ...(operation === "delete"
          ? {}
          : {
              payload:
                operation === "create"
                  ? {
                      itemId: String(target._id),
                      status: EUserItemStatus.PLANNED,
                    }
                  : { rating: 9 },
            }),
      })
      expect(response.statusCode).toBe(500)
      expect(
        await connection
          .collection("UserItem")
          .findOne({ _id: new Types.ObjectId(owner.entry.id) }),
      ).toEqual(beforeUser)
      if (operation === "create") {
        expect(
          await connection
            .collection("UserItem")
            .countDocuments({ item: target._id }),
        ).toBe(0)
      }
      expect(await readItem(target._id)).toEqual(beforeItem)
      expect(await readSite()).toEqual(beforeSite)
      expect(taste).not.toHaveBeenCalled()
    },
  )

  it("откатывает все три документа после записи SiteMetric и ошибки до commit", async () => {
    const { app, connection } = getTestApplication()
    const item = await createItem()
    const owner = await createEntry(item._id)
    await patch(owner, { rating: 7 })
    const beforeItem = await readItem(item._id)
    const beforeSite = await readSite()
    const site = app.get(SiteRatingsMetricRepository)
    const apply = site.applyChanges.bind(site)
    jest.spyOn(site, "applyChanges").mockImplementationOnce(async (props) => {
      await apply(props)
      throw new Error("Откат после изменения сайта")
    })
    const response = await app.inject({
      method: "PATCH",
      url: `/userItems/${owner.entry.id}`,
      headers: owner.headers,
      payload: { rating: 10 },
    })
    expect(response.statusCode).toBe(500)
    expect(await readItem(item._id)).toEqual(beforeItem)
    expect(await readSite()).toEqual(beforeSite)
    expect(
      await connection
        .collection("UserItem")
        .findOne({ _id: new Types.ObjectId(owner.entry.id) }),
    ).toMatchObject({ rating: 7 })
  })

  it("создаёт одну ItemMetric и учитывает все конкурентные добавления в библиотеку", async () => {
    const { app, connection } = getTestApplication()
    const item = await createItem()
    const accounts = []
    for (let index = 0; index < 4; index += 1) {
      accounts.push(await createAccount())
    }
    const responses = await Promise.all(
      accounts.map((account) =>
        app.inject({
          method: "POST",
          url: "/userItems",
          headers: account.headers,
          payload: {
            itemId: String(item._id),
            status: EUserItemStatus.PLANNED,
          },
        }),
      ),
    )
    expect(responses.map((response) => response.statusCode)).toEqual([
      201, 201, 201, 201,
    ])
    expect(
      await connection
        .collection("ItemMetric")
        .countDocuments({ item: item._id }),
    ).toBe(1)
    expect(await readItem(item._id)).toMatchObject({
      ratingsCount: 0,
      ratingAverage: null,
      statusCounts: {
        planned: 4,
        inProgress: 0,
        onHold: 0,
        completed: 0,
        dropped: 0,
      },
    })
    expect(await readSite()).toBeNull()
  })

  it("не теряет оценки при конкурентном первом создании общей метрики", async () => {
    const { app } = getTestApplication()
    const owners = []
    for (let index = 0; index < 4; index += 1) {
      owners.push(await createEntry((await createItem())._id))
    }
    const responses = await Promise.all(
      owners.map((owner, index) =>
        app.inject({
          method: "PATCH",
          url: `/userItems/${owner.entry.id}`,
          headers: owner.headers,
          payload: { rating: [1, 7, 10, 9][index] },
        }),
      ),
    )
    expect(responses.map((response) => response.statusCode)).toEqual([
      200, 200, 200, 200,
    ])
    expect(await readSite()).toMatchObject({ sum: 27, count: 4, average: 6.75 })
  })

  it("не удваивает одну оценку при конкурентных одинаковых запросах", async () => {
    const { app } = getTestApplication()
    const item = await createItem()
    const owner = await createEntry(item._id)
    const responses = await Promise.all(
      [1, 2].map(() =>
        app.inject({
          method: "PATCH",
          url: `/userItems/${owner.entry.id}`,
          headers: owner.headers,
          payload: { rating: 9 },
        }),
      ),
    )
    expect(responses.map((response) => response.statusCode)).toEqual([200, 200])
    expect(await readItem(item._id)).toMatchObject({
      ratingsCount: 1,
      ratingAverage: 9,
      ratingDistribution: { ...zeroDistribution, nine: 1 },
    })
    expect(await readSite()).toMatchObject({ sum: 9, count: 1, average: 9 })
  })

  it("повторяет целую транзакцию при конфликте первой записи SiteMetric без двойного вклада", async () => {
    const { app } = getTestApplication()
    const item = await createItem()
    const owner = await createEntry(item._id)
    const site = jest
      .spyOn(app.get(SiteRatingsMetricRepository), "applyChanges")
      .mockRejectedValueOnce(
        new mongo.MongoServerError({ code: 11000, keyPattern: { key: 1 } }),
      )
    await patch(owner, { rating: 8 })
    expect(site).toHaveBeenCalledTimes(2)
    expect(await readItem(item._id)).toMatchObject({
      ratingsCount: 1,
      ratingAverage: 8,
    })
    expect(await readSite()).toMatchObject({ sum: 8, count: 1, average: 8 })
  })

  it.each(["item", "site"])(
    "откатывает недопустимые отрицательные счётчики %s",
    async (kind) => {
      const { app } = getTestApplication()
      const item = await createItem()
      await expect(
        app.get(MongoTransactionService).run(async (session) => {
          if (kind === "site") {
            await app
              .get(SiteRatingsMetricRepository)
              .applyChanges({ sum: -7, count: -1, session })
          } else {
            await app.get(ItemMetricRepository).applyChanges({
              itemId: item._id,
              ratingsCount: -1,
              favoritesCount: 0,
              completedAttemptsCount: 0,
              ratingDistribution: { seven: -1 },
              statusCounts: {},
              session,
            })
          }
        }),
      ).rejects.toThrow()
      expect(await readItem(item._id)).toBeNull()
      expect(await readSite()).toBeNull()
    },
  )
})
