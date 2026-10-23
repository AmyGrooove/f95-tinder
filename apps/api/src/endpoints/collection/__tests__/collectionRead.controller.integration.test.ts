import { describe, expect, it } from "@jest/globals"
import { Types } from "mongoose"

import type { Session } from "@entities/session/schemas/session.schema"
import { getTestApplication } from "@test/setup/setupIntegration"

import { createCollection } from "./functions/createCollection"

describe("CollectionReadController HTTP", () => {
  it("публично возвращает только метаданные и блоки в авторском порядке", async () => {
    const { app } = getTestApplication()
    const { collection } = await createCollection()
    const response = await app.inject({
      method: "GET",
      url: `/collections/${collection.id}`,
      headers: { cookie: "__Host-accessToken=invalid" },
    })
    expect(response.statusCode).toBe(200)
    expect(response.headers["cache-control"]).toBe("no-store")
    expect(response.json()).toEqual(collection)
    expect(response.json()).not.toHaveProperty("items")
    expect(response.json()).not.toHaveProperty("deletedAt")
  })

  it("возвращает плоскую страницу в порядке подборки без личных полей гостя", async () => {
    const { app } = getTestApplication()
    const { collection, first, second, firstGroupId } = await createCollection()
    const response = await app.inject({
      method: "GET",
      url: `/collections/${collection.id}/items?mode=flat&limit=1`,
    })
    expect(response.statusCode).toBe(200)
    expect(response.headers["cache-control"]).toBe("no-store")
    expect(response.json()).toEqual({
      items: [
        {
          id: first._id.toHexString(),
          type: "movie",
          title: { ru: "Альфа", en: "Alpha" },
          media: [],
          membership: { groupId: firstGroupId, position: 1, note: "Заметка" },
        },
      ],
      page: 1,
      limit: 1,
      total: 2,
      pages: 2,
      isNextPage: true,
      isPreviousPage: false,
      mode: "flat",
      displayBlocks: [],
    })
    const next = await app.inject({
      method: "GET",
      url: `/collections/${collection.id}/items?mode=flat&limit=1&page=2`,
    })
    expect(next.statusCode).toBe(200)
    expect(next.json()).toMatchObject({
      items: [{ id: second._id.toHexString() }],
      page: 2,
      total: 2,
      isNextPage: false,
      isPreviousPage: true,
    })
  })

  it("выбирает grouped по умолчанию и размещает блоки перед соответствующими Item", async () => {
    const { app } = getTestApplication()
    const { collection, first, second, firstGroupId, secondGroupId, textId } =
      await createCollection()
    const response = await app.inject({
      method: "GET",
      url: `/collections/${collection.id}/items`,
    })
    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      mode: "grouped",
      total: 2,
      displayBlocks: [
        {
          id: firstGroupId,
          type: "group",
          beforeItemId: first._id.toHexString(),
        },
        {
          id: textId,
          type: "text",
          beforeItemId: second._id.toHexString(),
          content: { ru: "Текст", en: null },
        },
        {
          id: secondGroupId,
          type: "group",
          beforeItemId: second._id.toHexString(),
        },
      ],
    })
  })

  it("фильтрует группу и текст поиска, сортирует по названию и возвращает пустую страницу", async () => {
    const { app } = getTestApplication()
    const { collection, second, secondGroupId } = await createCollection()
    const base = `/collections/${collection.id}/items`
    const grouped = await app.inject({
      method: "GET",
      url: `${base}?groupId=${secondGroupId}&query=%20Beta%20&mode=flat`,
    })
    expect(grouped.statusCode).toBe(200)
    expect(grouped.json()).toMatchObject({
      total: 1,
      items: [{ id: second._id.toHexString() }],
    })
    const sorted = await app.inject({
      method: "GET",
      url: `${base}?sort=title&language=en&direction=desc&mode=flat&limit=1`,
    })
    expect(sorted.statusCode).toBe(200)
    expect(sorted.json()).toMatchObject({
      total: 2,
      items: [{ id: second._id.toHexString() }],
    })
    const empty = await app.inject({
      method: "GET",
      url: `${base}?query=missing&mode=flat`,
    })
    expect(empty.statusCode).toBe(200)
    expect(empty.json()).toMatchObject({
      items: [],
      total: 0,
      pages: 0,
      displayBlocks: [],
    })
  })

  it("исключает удалённые и отсутствующие Item из страницы и доступных режимов", async () => {
    const { app, connection } = getTestApplication()
    const { collection, first, second } = await createCollection()
    await connection
      .collection("Item")
      .updateOne({ _id: first._id }, { $set: { deletedAt: new Date() } })
    await connection.collection("Item").deleteOne({ _id: second._id })
    const response = await app.inject({
      method: "GET",
      url: `/collections/${collection.id}/items?mode=flat`,
    })
    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({ items: [], total: 0 })
    expect(await connection.collection("CollectionItem").countDocuments()).toBe(
      2,
    )
  })

  it("возвращает flat для пустой подборки и запрещает недоступный grouped", async () => {
    const { app } = getTestApplication()
    const { collection } = await createCollection({ blocks: [], items: [] })
    const response = await app.inject({
      method: "GET",
      url: `/collections/${collection.id}/items`,
    })
    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      items: [],
      total: 0,
      mode: "flat",
      displayBlocks: [],
    })
    const filters = await app.inject({
      method: "GET",
      url: `/collections/${collection.id}/filters`,
    })
    expect(filters.statusCode).toBe(200)
    expect(filters.json()).toEqual({
      tags: [],
      features: [],
      sorting: { availableModes: ["flat"] },
    })
    expect(
      (
        await app.inject({
          method: "GET",
          url: `/collections/${collection.id}/items?mode=grouped`,
        })
      ).statusCode,
    ).toBe(400)
  })

  it("добавляет личные данные только текущего пользователя и применяет личные фильтры", async () => {
    const { app } = getTestApplication()
    const { collection, first, second, owner } = await createCollection()
    const library = await app.inject({
      method: "POST",
      url: "/userItems",
      headers: owner.headers,
      payload: { itemId: first._id.toHexString(), status: "planned" },
    })
    expect(library.statusCode).toBe(201)
    const base = `/collections/${collection.id}/items?mode=flat`
    const response = await app.inject({
      method: "GET",
      url: base,
      headers: owner.headers,
    })
    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      items: [
        {
          id: first._id.toHexString(),
          userItem: { status: "planned", rating: null, isFavorite: false },
        },
        { id: second._id.toHexString(), userItem: null },
      ],
    })
    for (const filter of [
      "isInLibrary=true",
      "statuses=planned",
      "isFavorite=false",
    ]) {
      const filtered = await app.inject({
        method: "GET",
        url: `${base}&${filter}`,
        headers: owner.headers,
      })
      expect(filtered.statusCode).toBe(200)
      expect(filtered.json()).toMatchObject({
        total: 1,
        items: [{ id: first._id.toHexString() }],
      })
    }
    const absent = await app.inject({
      method: "GET",
      url: `${base}&isInLibrary=false`,
      headers: owner.headers,
    })
    expect(absent.statusCode).toBe(200)
    expect(absent.json()).toMatchObject({
      total: 1,
      items: [{ id: second._id.toHexString(), userItem: null }],
    })
  })

  it.each([
    "isInLibrary=false",
    "isFavorite=false",
    "statuses=planned",
    "ratingMin=1",
    "ratingMax=10",
  ])("требует авторизацию для личного фильтра %s", async (query) => {
    const { app } = getTestApplication()
    const { collection } = await createCollection()
    expect(
      (
        await app.inject({
          method: "GET",
          url: `/collections/${collection.id}/items?${query}`,
        })
      ).statusCode,
    ).toBe(401)
  })

  it("отклоняет переданный неверный cookie и истёкшую сессию даже без личных фильтров", async () => {
    const { app, connection } = getTestApplication()
    const { collection, owner } = await createCollection()
    const url = `/collections/${collection.id}/items`
    expect(
      (
        await app.inject({
          method: "GET",
          url,
          headers: { cookie: "__Host-accessToken=invalid" },
        })
      ).statusCode,
    ).toBe(401)
    await connection
      .collection<Session>("Session")
      .updateOne(
        { _id: owner.session._id },
        { $set: { expiresAt: new Date(Date.now() - 1000) } },
      )
    expect(
      (await app.inject({ method: "GET", url, headers: owner.headers }))
        .statusCode,
    ).toBe(401)
  })

  it("ограничивает доступные теги группой, сохраняя режимы всей подборки", async () => {
    const { app, connection } = getTestApplication()
    const { collection, first, second, firstGroupId } = await createCollection()
    const tagA = new Types.ObjectId()
    const tagB = new Types.ObjectId()
    await connection.collection("Tag").insertMany([
      { _id: tagA, key: "alpha", group: "genre", name: { ru: "А", en: "A" } },
      { _id: tagB, key: "beta", group: "genre", name: { ru: "Б", en: "B" } },
    ])
    await connection.collection("ItemTag").insertMany([
      { item: first._id, tag: tagA },
      { item: second._id, tag: tagB },
    ])
    const base = `/collections/${collection.id}`
    const all = await app.inject({ method: "GET", url: `${base}/filters` })
    expect(all.statusCode).toBe(200)
    expect(all.headers["cache-control"]).toBe("no-store")
    expect(all.json()).toEqual({
      tags: [
        {
          id: tagA.toHexString(),
          key: "alpha",
          group: "genre",
          name: { ru: "А", en: "A" },
        },
        {
          id: tagB.toHexString(),
          key: "beta",
          group: "genre",
          name: { ru: "Б", en: "B" },
        },
      ],
      features: [],
      sorting: { availableModes: ["flat", "grouped"] },
    })
    const scoped = await app.inject({
      method: "GET",
      url: `${base}/filters?groupId=${firstGroupId}`,
    })
    expect(scoped.statusCode).toBe(200)
    expect(scoped.json()).toMatchObject({
      tags: [{ id: tagA.toHexString() }],
      sorting: { availableModes: ["flat", "grouped"] },
    })
    expect(scoped.json<{ tags: unknown[] }>().tags).toHaveLength(1)
    for (const query of [
      `tags=${tagA.toHexString()}`,
      `excludeTags=${tagB.toHexString()}`,
    ]) {
      const items = await app.inject({
        method: "GET",
        url: `${base}/items?mode=flat&${query}`,
      })
      expect(items.statusCode).toBe(200)
      expect(items.json()).toMatchObject({
        total: 1,
        items: [{ id: first._id.toHexString() }],
      })
    }
  })

  it("возвращает диапазоны характеристик и фильтрует по числу, дате и boolean", async () => {
    const { app, connection } = getTestApplication()
    const { collection, first, second } = await createCollection()
    const numberId = new Types.ObjectId()
    const dateId = new Types.ObjectId()
    const booleanId = new Types.ObjectId()
    const definitions = [
      { _id: numberId, key: "duration", valueType: "number" },
      { _id: dateId, key: "releaseDate", valueType: "date" },
      { _id: booleanId, key: "isReleased", valueType: "boolean" },
    ]
    await connection.collection("Feature").insertMany(
      definitions.map((definition) => ({
        ...definition,
        group: null,
        unit: null,
        name: { ru: definition.key, en: null },
      })),
    )
    await connection.collection("ItemFeature").insertMany([
      { item: first._id, feature: numberId, value: 90 },
      { item: second._id, feature: numberId, value: 120 },
      { item: first._id, feature: dateId, value: new Date("2020-01-01") },
      { item: second._id, feature: dateId, value: new Date("2025-01-01") },
      { item: first._id, feature: booleanId, value: false },
      { item: second._id, feature: booleanId, value: true },
    ])
    const response = await app.inject({
      method: "GET",
      url: `/collections/${collection.id}/filters`,
    })
    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      features: [
        { id: numberId.toHexString(), valueType: "number", min: 90, max: 120 },
        {
          id: booleanId.toHexString(),
          valueType: "boolean",
          values: [false, true],
        },
        {
          id: dateId.toHexString(),
          valueType: "date",
          min: "2020-01-01T00:00:00.000Z",
          max: "2025-01-01T00:00:00.000Z",
        },
      ],
    })
    for (const filter of [
      { featureId: numberId.toHexString(), min: 120, max: 120 },
      { featureId: dateId.toHexString(), min: "2025-01-01" },
      { featureId: booleanId.toHexString(), values: [true] },
    ]) {
      const items = await app.inject({
        method: "GET",
        url: `/collections/${collection.id}/items?mode=flat&features=${encodeURIComponent(JSON.stringify([filter]))}`,
      })
      expect(items.statusCode).toBe(200)
      expect(items.json()).toMatchObject({
        total: 1,
        items: [{ id: second._id.toHexString() }],
      })
    }
    for (const filters of [
      [{ featureId: numberId.toHexString(), min: 120, max: 90 }],
      [{ featureId: numberId.toHexString(), min: "90" }],
      [{ featureId: booleanId.toHexString(), min: 1 }],
      [{ featureId: dateId.toHexString(), min: "not-a-date" }],
      [{ featureId: new Types.ObjectId().toHexString(), min: 1 }],
      [
        { featureId: numberId.toHexString(), min: 1 },
        { featureId: numberId.toHexString(), min: 2 },
      ],
    ]) {
      expect(
        (
          await app.inject({
            method: "GET",
            url: `/collections/${collection.id}/items?features=${encodeURIComponent(JSON.stringify(filters))}`,
          })
        ).statusCode,
      ).toBe(400)
    }
  })

  it.each([
    "page=0",
    "page=1.5",
    "limit=101",
    "limit=0",
    "mode=unknown",
    "sort=unknown",
    "direction=up",
    "language=fr",
    "tags=bad",
    "excludeTags=bad",
    "features=bad",
    "statuses=unknown",
    "isFavorite=1",
    "ratingMin=0",
    "ratingMax=11",
    "ratingMin=10&ratingMax=1",
    "query=%20%20",
    "unknown=1",
    "page=9007199254740991&limit=100",
  ])("отклоняет некорректный query страницы: %s", async (query) => {
    const { app } = getTestApplication()
    const { collection, owner } = await createCollection()
    expect(
      (
        await app.inject({
          method: "GET",
          url: `/collections/${collection.id}/items?${query}`,
          headers: owner.headers,
        })
      ).statusCode,
    ).toBe(400)
  })

  it.each(["", "/items", "/filters"])(
    "проверяет id и скрывает удалённую или отсутствующую подборку для GET %s",
    async (suffix) => {
      const { app, connection } = getTestApplication()
      const { collection } = await createCollection()
      expect(
        (
          await app.inject({
            method: "GET",
            url: `/collections/invalid${suffix}`,
          })
        ).statusCode,
      ).toBe(400)
      expect(
        (
          await app.inject({
            method: "GET",
            url: `/collections/${new Types.ObjectId().toHexString()}${suffix}`,
          })
        ).statusCode,
      ).toBe(404)
      await connection
        .collection("Collection")
        .updateOne(
          { _id: new Types.ObjectId(collection.id) },
          { $set: { deletedAt: new Date() } },
        )
      expect(
        (
          await app.inject({
            method: "GET",
            url: `/collections/${collection.id}${suffix}`,
          })
        ).statusCode,
      ).toBe(404)
    },
  )

  it.each(["items", "filters"])(
    "отклоняет некорректную и чужую группу для %s",
    async (path) => {
      const { app } = getTestApplication()
      const { collection, textId } = await createCollection()
      for (const groupId of [
        "invalid",
        textId,
        new Types.ObjectId().toHexString(),
      ]) {
        expect(
          (
            await app.inject({
              method: "GET",
              url: `/collections/${collection.id}/${path}?groupId=${groupId}`,
            })
          ).statusCode,
        ).toBe(400)
      }
    },
  )
})
