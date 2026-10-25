import { describe, expect, it } from "@jest/globals"
import { Types } from "mongoose"

import { ECollectionType } from "@entities/collection/schemas/ECollectionType"
import { EMediaType } from "@entities/shared/schemas/EMediaType"
import type { Session } from "@entities/session/schemas/session.schema"
import { getTestApplication } from "@test/setup/setupIntegration"

import { createCollection } from "./functions/createCollection"
import type { QueryCollectionsResponseDto } from "../dto/response/queryCollections.response"

describe("CollectionReadController HTTP", () => {
  describe("QUERY /collections", () => {
    const createQueryFixture = async () => {
      const { connection } = getTestApplication()
      const firstItemId = new Types.ObjectId()
      const secondItemId = new Types.ObjectId()
      const authorId = new Types.ObjectId()
      const createdAt = new Date("2026-10-25T10:00:00.000Z")
      const definitions = [
        { type: ECollectionType.CUSTOM, author: authorId },
        { type: ECollectionType.CUSTOM, author: null },
        { type: ECollectionType.FRANCHISE, author: null },
        { type: ECollectionType.FRANCHISE, author: authorId },
        { type: ECollectionType.TAG, author: null },
        { type: ECollectionType.FEATURE, author: null },
        {
          type: ECollectionType.CUSTOM,
          author: authorId,
          deletedAt: createdAt,
        },
      ]
      const collections = definitions.map((definition, index) => ({
        _id: new Types.ObjectId(),
        version: 0,
        title: { ru: `Подборка ${index}`, en: null },
        description: { ru: "Полное описание", en: null },
        media: [
          { src: "/poster.jpg", language: null, type: EMediaType.POSTER },
        ],
        blocks: [{ id: new Types.ObjectId(), type: "group" }],
        deletedAt: null,
        createdAt,
        updatedAt: createdAt,
        ...definition,
      }))
      const [first, second, franchise, userFranchise, tag, feature, deleted] =
        collections
      await connection.collection("Collection").insertMany(collections)
      await connection.collection("CollectionItem").insertMany(
        [
          { collection: first, itemIds: [firstItemId] },
          { collection: second, itemIds: [secondItemId] },
          { collection: franchise, itemIds: [firstItemId, secondItemId] },
          { collection: userFranchise, itemIds: [firstItemId] },
          { collection: deleted, itemIds: [firstItemId] },
        ].flatMap(({ collection, itemIds }) =>
          itemIds.map((item, position) => ({
            collectionId: collection._id,
            item,
            groupId: collection.blocks[0].id,
            position,
            note: null,
          })),
        ),
      )

      return {
        firstItemId,
        secondItemId,
        authorId,
        first,
        second,
        franchise,
        userFranchise,
        tag,
        feature,
        deleted,
      }
    }

    it("возвращает пустую страницу без фильтров при отсутствии коллекций", async () => {
      const { app } = getTestApplication()
      const response = await app.inject({
        method: "QUERY",
        url: "/collections",
        payload: {},
      } as unknown as Parameters<typeof app.inject>[0])

      expect(response.statusCode).toBe(200)
      expect(response.json()).toEqual({
        items: [],
        page: 1,
        limit: 20,
        total: 0,
        pages: 0,
        isNextPage: false,
        isPreviousPage: false,
      })
    })

    it("возвращает гостю краткие карточки с пагинацией по умолчанию и не проверяет cookie", async () => {
      const { app } = getTestApplication()
      const { first } = await createQueryFixture()
      const response = await app.inject({
        method: "QUERY",
        url: "/collections",
        headers: { cookie: "__Host-accessToken=invalid" },
        payload: {},
      } as unknown as Parameters<typeof app.inject>[0])

      expect(response.statusCode).toBe(200)
      expect(response.headers["cache-control"]).toBe("no-store")
      expect(response.headers["accept-query"]).toBe("application/json")
      const result = response.json<QueryCollectionsResponseDto>()
      expect(result).toMatchObject({
        page: 1,
        limit: 20,
        total: 6,
        pages: 1,
        isNextPage: false,
        isPreviousPage: false,
      })
      expect(result.items).toHaveLength(6)
      expect(
        result.items.find((item) => item.id === first._id.toHexString()),
      ).toEqual({
        id: first._id.toHexString(),
        type: "custom",
        authorId: first.author?.toHexString(),
        title: { ru: "Подборка 0", en: null },
        media: [{ src: "/poster.jpg", language: null, type: "poster" }],
      })
      for (const item of result.items) {
        expect(Object.keys(item).sort()).toEqual([
          "authorId",
          "id",
          "media",
          "title",
          "type",
        ])
      }
    })

    it("находит коллекции с любым указанным Item без дублей и исключает удалённые до пагинации", async () => {
      const { app } = getTestApplication()
      const { firstItemId, secondItemId, first, second, franchise } =
        await createQueryFixture()
      const response = await app.inject({
        method: "QUERY",
        url: "/collections",
        payload: {
          itemIds: [
            firstItemId.toHexString().toUpperCase(),
            secondItemId.toHexString(),
          ],
          type: "custom",
          limit: 1,
        },
      } as unknown as Parameters<typeof app.inject>[0])

      expect(response.statusCode).toBe(200)
      expect(response.json()).toMatchObject({
        total: 2,
        pages: 2,
        isNextPage: true,
        items: [{ id: second._id.toHexString() }],
      })

      const all = await app.inject({
        method: "QUERY",
        url: "/collections",
        payload: {
          itemIds: [firstItemId.toHexString(), secondItemId.toHexString()],
        },
      } as unknown as Parameters<typeof app.inject>[0])
      expect(all.statusCode).toBe(200)
      const ids = all
        .json<QueryCollectionsResponseDto>()
        .items.map((item) => item.id)
      expect(ids).toContain(first._id.toHexString())
      expect(ids).toContain(second._id.toHexString())
      expect(
        ids.filter((id) => id === franchise._id.toHexString()),
      ).toHaveLength(1)
      expect(ids).toHaveLength(4)
      expect(all.json()).toMatchObject({ total: 4 })
    })

    it("ограничивает выдачу франшизами сайта и сохраняет фильтр по составу", async () => {
      const { app, connection } = getTestApplication()
      const { firstItemId, franchise, userFranchise } =
        await createQueryFixture()
      await connection.collection("Collection").insertOne({
        ...franchise,
        _id: new Types.ObjectId(),
        title: { ru: "Без этого Item", en: null },
      })

      const response = await app.inject({
        method: "QUERY",
        url: "/collections",
        payload: { type: "franchise", itemIds: [firstItemId.toHexString()] },
      } as unknown as Parameters<typeof app.inject>[0])

      expect(response.statusCode).toBe(200)
      expect(response.json()).toMatchObject({
        total: 1,
        items: [{ id: franchise._id.toHexString(), authorId: null }],
      })
      expect(response.body).not.toContain(userFranchise._id.toHexString())
    })

    it.each(["tag", "feature"])(
      "фильтрует по типу %s без обязательного itemIds",
      async (type) => {
        const { app } = getTestApplication()
        const fixture = await createQueryFixture()
        const expected = type === "tag" ? fixture.tag : fixture.feature
        const response = await app.inject({
          method: "QUERY",
          url: "/collections",
          payload: { type },
        } as unknown as Parameters<typeof app.inject>[0])

        expect(response.statusCode).toBe(200)
        expect(response.json()).toMatchObject({
          total: 1,
          items: [{ id: expected._id.toHexString(), type }],
        })
      },
    )

    it("сортирует по дате создания и ID при равных датах, сохраняя total на следующих страницах", async () => {
      const { app, connection } = getTestApplication()
      const { first, second } = await createQueryFixture()
      await connection
        .collection("Collection")
        .updateOne(
          { _id: first._id },
          { $set: { createdAt: new Date("2026-10-26T00:00:00.000Z") } },
        )

      for (const [page, id] of [
        [1, first._id],
        [2, second._id],
      ] as const) {
        const response = await app.inject({
          method: "QUERY",
          url: "/collections",
          payload: { type: "custom", page, limit: 1 },
        } as unknown as Parameters<typeof app.inject>[0])

        expect(response.statusCode).toBe(200)
        expect(response.json()).toMatchObject({
          page,
          limit: 1,
          total: 2,
          pages: 2,
          isNextPage: page === 1,
          isPreviousPage: page === 2,
          items: [{ id: id.toHexString() }],
        })
      }
    })

    it("возвращает пустую страницу за пределами результатов с сохранением total", async () => {
      const { app } = getTestApplication()
      await createQueryFixture()
      const response = await app.inject({
        method: "QUERY",
        url: "/collections",
        payload: { type: "custom", page: 3, limit: 1 },
      } as unknown as Parameters<typeof app.inject>[0])

      expect(response.statusCode).toBe(200)
      expect(response.json()).toEqual({
        items: [],
        page: 3,
        limit: 1,
        total: 2,
        pages: 2,
        isNextPage: false,
        isPreviousPage: true,
      })
    })

    it("возвращает пустой результат для неизвестного Item без 404", async () => {
      const { app } = getTestApplication()
      await createQueryFixture()
      const response = await app.inject({
        method: "QUERY",
        url: "/collections",
        payload: { itemIds: [new Types.ObjectId().toHexString()] },
      } as unknown as Parameters<typeof app.inject>[0])

      expect(response.statusCode).toBe(200)
      expect(response.json()).toEqual({
        items: [],
        page: 1,
        limit: 20,
        total: 0,
        pages: 0,
        isNextPage: false,
        isPreviousPage: false,
      })
    })

    it("проверяет сохранённое членство без требования существующего неудалённого Item", async () => {
      const { app, connection } = getTestApplication()
      const { firstItemId, first } = await createQueryFixture()
      await connection
        .collection("Item")
        .insertOne({ _id: firstItemId, type: "movie", deletedAt: new Date() })
      const payload = { type: "custom", itemIds: [firstItemId.toHexString()] }

      for (const isDeleted of [false, true]) {
        if (isDeleted) {
          await connection.collection("Item").deleteOne({ _id: firstItemId })
        }
        const response = await app.inject({
          method: "QUERY",
          url: "/collections",
          payload,
        } as unknown as Parameters<typeof app.inject>[0])
        expect(response.statusCode).toBe(200)
        expect(response.json()).toMatchObject({
          total: 1,
          items: [{ id: first._id.toHexString() }],
        })
      }
    })

    it("возвращает все 60 карточек и принимает 60 уникальных Item ID без усечения", async () => {
      const { app, connection } = getTestApplication()
      const { first, firstItemId } = await createQueryFixture()
      await connection.collection("Collection").insertMany(
        Array.from({ length: 58 }, () => ({
          ...first,
          _id: new Types.ObjectId(),
        })),
      )
      const itemIds = [
        ...Array.from({ length: 59 }, () => new Types.ObjectId().toHexString()),
        firstItemId.toHexString(),
      ]
      const all = await app.inject({
        method: "QUERY",
        url: "/collections",
        payload: { type: "custom", limit: 60 },
      } as unknown as Parameters<typeof app.inject>[0])
      expect(all.statusCode).toBe(200)
      expect(all.json()).toMatchObject({
        limit: 60,
        total: 60,
        pages: 1,
        isNextPage: false,
      })
      expect(all.json<QueryCollectionsResponseDto>().items).toHaveLength(60)

      const defaultPage = await app.inject({
        method: "QUERY",
        url: "/collections",
        payload: { type: "custom" },
      } as unknown as Parameters<typeof app.inject>[0])
      expect(defaultPage.statusCode).toBe(200)
      expect(defaultPage.json()).toMatchObject({
        page: 1,
        limit: 20,
        total: 60,
        pages: 3,
        isNextPage: true,
      })
      expect(
        defaultPage.json<QueryCollectionsResponseDto>().items,
      ).toHaveLength(20)

      const filtered = await app.inject({
        method: "QUERY",
        url: "/collections",
        payload: { itemIds, type: "custom" },
      } as unknown as Parameters<typeof app.inject>[0])
      expect(filtered.statusCode).toBe(200)
      expect(filtered.json()).toMatchObject({
        total: 1,
        items: [{ id: first._id.toHexString() }],
      })
    })

    it.each([
      { limit: 61 },
      { limit: 100 },
      { page: Number.MAX_SAFE_INTEGER, limit: 60 },
      { itemIds: ["507f1f77bcf86cd799439011", "507F1F77BCF86CD799439011"] },
      {
        itemIds: Array.from({ length: 61 }, () =>
          new Types.ObjectId().toHexString(),
        ),
      },
      { query: "Подборка" },
    ])("возвращает 400 для недопустимого запроса %j", async (payload) => {
      const { app } = getTestApplication()
      const response = await app.inject({
        method: "QUERY",
        url: "/collections",
        payload,
      } as unknown as Parameters<typeof app.inject>[0])

      expect(response.statusCode).toBe(400)
      expect(response.json()).toHaveProperty("error.code", "BAD_REQUEST")
    })

    it.each(["null", "[]", "[{}]", "true", "42", '"text"'])(
      "возвращает 400 для JSON-тела %s вместо объекта",
      async (payload) => {
        const { app } = getTestApplication()
        const response = await app.inject({
          method: "QUERY",
          url: "/collections",
          headers: { "content-type": "application/json" },
          payload,
        } as unknown as Parameters<typeof app.inject>[0])

        expect(response.statusCode).toBe(400)
        expect(response.json()).toHaveProperty("error.code", "BAD_REQUEST")
      },
    )

    it("не применяет личное скрытие, не раскрывает личные поля и не изменяет данные", async () => {
      const { app, connection } = getTestApplication()
      const { owner, collection, first } = await createCollection()
      await connection.collection("UserCollection").insertOne({
        collectionId: new Types.ObjectId(collection.id),
        user: owner.user._id,
        isHidden: true,
        isFavorite: true,
        rating: 9,
      })
      await connection.collection("UserItem").insertOne({
        user: owner.user._id,
        item: first._id,
        status: "blocked",
        note: "Приватная заметка",
        attempts: [],
      })
      const names = [
        "Collection",
        "CollectionItem",
        "UserCollection",
        "UserItem",
      ]
      const before = await Promise.all(
        names.map(async (name) =>
          connection.collection(name).find().sort({ _id: 1 }).toArray(),
        ),
      )
      const payload = { itemIds: [first._id.toHexString()] }

      const guest = await app.inject({
        method: "QUERY",
        url: "/collections",
        payload,
      } as unknown as Parameters<typeof app.inject>[0])
      const authenticated = await app.inject({
        method: "QUERY",
        url: "/collections",
        payload,
        headers: owner.headers,
      } as unknown as Parameters<typeof app.inject>[0])
      expect(guest.statusCode).toBe(200)
      expect(authenticated.statusCode).toBe(200)
      expect(authenticated.json()).toEqual(guest.json())
      expect(guest.json()).toMatchObject({
        total: 1,
        items: [{ id: collection.id }],
      })
      expect(guest.body).not.toContain("Приватная заметка")
      expect(
        Object.keys(guest.json<QueryCollectionsResponseDto>().items[0]).sort(),
      ).toEqual(["authorId", "id", "media", "title", "type"])
      const after = await Promise.all(
        names.map(async (name) =>
          connection.collection(name).find().sort({ _id: 1 }).toArray(),
        ),
      )
      expect(after).toEqual(before)
    })

    it("разрешает CORS для QUERY и сохраняет проверку origin для публичного чтения", async () => {
      const { app } = getTestApplication()
      const preflight = await app.inject({
        method: "OPTIONS",
        url: "/collections",
        headers: {
          origin: "http://localhost",
          "access-control-request-method": "QUERY",
          "access-control-request-headers": "content-type",
        },
      })
      expect(preflight.statusCode).toBe(204)
      expect(preflight.headers["access-control-allow-methods"]).toContain(
        "QUERY",
      )

      for (const [origin, status] of [
        ["http://localhost", 200],
        ["https://untrusted.example", 403],
      ] as const) {
        const response = await app.inject({
          method: "QUERY",
          url: "/collections",
          headers: { origin, "sec-fetch-site": "cross-site" },
          payload: {},
        } as unknown as Parameters<typeof app.inject>[0])
        expect(response.statusCode).toBe(status)
      }
    })
  })

  it("принимает максимальный размер страницы 60 без изменения total", async () => {
    const { app } = getTestApplication()
    const { collection } = await createCollection()
    const response = await app.inject({
      method: "QUERY",
      url: "/collections/" + collection.id + "/items",
      payload: { limit: 60, mode: "flat" },
    } as unknown as Parameters<typeof app.inject>[0])
    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      limit: 60,
      page: 1,
      pages: 1,
      total: 2,
    })
    expect(response.json<{ items: unknown[] }>().items).toHaveLength(2)
  })

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
      method: "QUERY",
      url: `/collections/${collection.id}/items`,
      payload: { mode: "flat", limit: 1 },
    } as unknown as Parameters<typeof app.inject>[0])
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
      method: "QUERY",
      url: `/collections/${collection.id}/items`,
      payload: { mode: "flat", limit: 1, page: 2 },
    } as unknown as Parameters<typeof app.inject>[0])
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
      method: "QUERY",
      url: `/collections/${collection.id}/items`,
      payload: {},
    } as unknown as Parameters<typeof app.inject>[0])
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
      method: "QUERY",
      url: base,
      payload: { groupId: secondGroupId, query: " Beta ", mode: "flat" },
    } as unknown as Parameters<typeof app.inject>[0])
    expect(grouped.statusCode).toBe(200)
    expect(grouped.json()).toMatchObject({
      total: 1,
      items: [{ id: second._id.toHexString() }],
    })
    const sorted = await app.inject({
      method: "QUERY",
      url: base,
      payload: {
        sort: "title",
        language: "en",
        direction: "desc",
        mode: "flat",
        limit: 1,
      },
    } as unknown as Parameters<typeof app.inject>[0])
    expect(sorted.statusCode).toBe(200)
    expect(sorted.json()).toMatchObject({
      total: 2,
      items: [{ id: second._id.toHexString() }],
    })
    const empty = await app.inject({
      method: "QUERY",
      url: base,
      payload: { query: "missing", mode: "flat" },
    } as unknown as Parameters<typeof app.inject>[0])
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
      method: "QUERY",
      url: `/collections/${collection.id}/items`,
      payload: { mode: "flat" },
    } as unknown as Parameters<typeof app.inject>[0])
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
      method: "QUERY",
      url: `/collections/${collection.id}/items`,
      payload: {},
    } as unknown as Parameters<typeof app.inject>[0])
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
          method: "QUERY",
          url: `/collections/${collection.id}/items`,
          payload: { mode: "grouped" },
        } as unknown as Parameters<typeof app.inject>[0])
      ).statusCode,
    ).toBe(400)
  })

  it("возвращает одинаковый публичный состав гостю и владельцу с личными данными", async () => {
    const { app, connection } = getTestApplication()
    const { collection, first, owner } = await createCollection()
    const created = await app.inject({
      method: "POST",
      url: "/userItems",
      headers: owner.headers,
      payload: { itemId: first._id.toHexString(), status: "inProgress" },
    })
    expect(created.statusCode).toBe(201)
    const updated = await app.inject({
      method: "PATCH",
      url: "/userItems/" + created.json<{ id: string }>().id,
      headers: owner.headers,
      payload: { rating: 10, isFavorite: true, note: "Секретная заметка" },
    })
    expect(updated.statusCode).toBe(200)
    const before = await connection
      .collection("UserItem")
      .findOne({ item: first._id })
    const url = "/collections/" + collection.id + "/items"
    const guest = await app.inject({
      method: "QUERY",
      url,
      payload: {},
    } as unknown as Parameters<typeof app.inject>[0])
    const signedIn = await app.inject({
      method: "QUERY",
      url,
      headers: owner.headers,
      payload: {},
    } as unknown as Parameters<typeof app.inject>[0])
    expect(guest.statusCode).toBe(200)
    expect(signedIn.statusCode).toBe(200)
    expect(signedIn.json()).toEqual(guest.json())
    expect(signedIn.headers["cache-control"]).toBe("no-store")
    for (const card of signedIn.json<{ items: Record<string, unknown>[] }>()
      .items) {
      expect(Object.keys(card).sort()).toEqual([
        "id",
        "media",
        "membership",
        "title",
        "type",
      ])
    }
    expect(
      await connection.collection("UserItem").findOne({ item: first._id }),
    ).toEqual(before)
  })

  it.each([
    { isInLibrary: true },
    { isInLibrary: false },
    { isFavorite: true },
    { isFavorite: false },
    { statuses: ["planned"] },
    { statuses: ["skipped", "blocked"] },
  ])(
    "отклоняет удалённый личный фильтр %s и у гостя, и у владельца",
    async (query) => {
      const { app } = getTestApplication()
      const { collection, owner } = await createCollection()
      const url = "/collections/" + collection.id + "/items"
      for (const headers of [{}, owner.headers]) {
        const response = await app.inject({
          method: "QUERY",
          url,
          headers,
          payload: query,
        } as unknown as Parameters<typeof app.inject>[0])
        expect(response.statusCode).toBe(400)
      }
    },
  )

  it("игнорирует неверную cookie, истёкшую и отозванную сессию при публичном чтении", async () => {
    const { app, connection } = getTestApplication()
    const { collection, owner } = await createCollection()
    const url = "/collections/" + collection.id + "/items"
    const guest = await app.inject({
      method: "QUERY",
      url,
      payload: {},
    } as unknown as Parameters<typeof app.inject>[0])
    expect(guest.statusCode).toBe(200)
    const invalid = await app.inject({
      method: "QUERY",
      url,
      headers: { cookie: "__Host-accessToken=invalid" },
      payload: {},
    } as unknown as Parameters<typeof app.inject>[0])
    expect(invalid.statusCode).toBe(200)
    expect(invalid.json()).toEqual(guest.json())
    await connection
      .collection<Session>("Session")
      .updateOne(
        { _id: owner.session._id },
        { $set: { expiresAt: new Date(Date.now() - 1000) } },
      )
    const expired = await app.inject({
      method: "QUERY",
      url,
      headers: owner.headers,
      payload: {},
    } as unknown as Parameters<typeof app.inject>[0])
    expect(expired.statusCode).toBe(200)
    expect(expired.json()).toEqual(guest.json())
    await connection.collection("Session").deleteOne({ _id: owner.session._id })
    const revoked = await app.inject({
      method: "QUERY",
      url,
      headers: owner.headers,
      payload: {},
    } as unknown as Parameters<typeof app.inject>[0])
    expect(revoked.statusCode).toBe(200)
    expect(revoked.json()).toEqual(guest.json())
  })
  it("возвращает доступные теги и режимы всей подборки и отклоняет query", async () => {
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
    for (const query of [
      `groupId=${firstGroupId}`,
      "groupId=",
      "query=Alpha",
      "page=1",
      "unknown=1",
    ]) {
      const response = await app.inject({
        method: "GET",
        url: `${base}/filters?${query}`,
      })
      expect(response.statusCode).toBe(400)
    }
    for (const query of [
      { tags: [tagA.toHexString()] },
      { excludeTags: [tagB.toHexString()] },
    ]) {
      const items = await app.inject({
        method: "QUERY",
        url: `${base}/items`,
        payload: { mode: "flat", ...query },
      } as unknown as Parameters<typeof app.inject>[0])
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
        method: "QUERY",
        url: `/collections/${collection.id}/items`,
        payload: { mode: "flat", features: [filter] },
      } as unknown as Parameters<typeof app.inject>[0])
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
            method: "QUERY",
            url: `/collections/${collection.id}/items`,
            payload: { features: filters },
          } as unknown as Parameters<typeof app.inject>[0])
        ).statusCode,
      ).toBe(400)
    }
  })

  it.each([
    { page: 0 },
    { page: 1.5 },
    { limit: 61 },
    { limit: 100 },
    { limit: 0 },
    { mode: "unknown" },
    { sort: "unknown" },
    { direction: "up" },
    { language: "fr" },
    { tags: "bad" },
    { excludeTags: "bad" },
    { features: "bad" },
    { statuses: ["unknown"] },
    { isFavorite: 1 },
    { ratingMin: 0 },
    { ratingMax: 11 },
    { ratingMin: 10.1 },
    { ratingMax: 0.9 },
    { ratingMin: "NaN" },
    { ratingMax: "Infinity" },
    { ratingMin: "" },
    { ratingMax: "bad" },
    { ratingMin: [7, 8] },
    { ratingMin: 10, ratingMax: 1 },
    { query: "  " },
    { unknown: "1" },
    { page: 9007199254740991, limit: 60 },
  ])("отклоняет некорректное тело запроса страницы: %j", async (query) => {
    const { app } = getTestApplication()
    const { collection, owner } = await createCollection()
    expect(
      (
        await app.inject({
          method: "QUERY",
          url: `/collections/${collection.id}/items`,
          payload: query,
          headers: owner.headers,
        } as unknown as Parameters<typeof app.inject>[0])
      ).statusCode,
    ).toBe(400)
  })

  it.each(["", "/items", "/filters"])(
    "проверяет id и скрывает удалённую или отсутствующую подборку для %s",
    async (suffix) => {
      const { app, connection } = getTestApplication()
      const { collection } = await createCollection()
      expect(
        (
          await app.inject({
            method: suffix === "/items" ? "QUERY" : "GET",
            url: `/collections/invalid${suffix}`,
            ...(suffix === "/items" ? { payload: {} } : {}),
          } as unknown as Parameters<typeof app.inject>[0])
        ).statusCode,
      ).toBe(400)
      expect(
        (
          await app.inject({
            method: suffix === "/items" ? "QUERY" : "GET",
            url: `/collections/${new Types.ObjectId().toHexString()}${suffix}`,
            ...(suffix === "/items" ? { payload: {} } : {}),
          } as unknown as Parameters<typeof app.inject>[0])
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
            method: suffix === "/items" ? "QUERY" : "GET",
            url: `/collections/${collection.id}${suffix}`,
            ...(suffix === "/items" ? { payload: {} } : {}),
          } as unknown as Parameters<typeof app.inject>[0])
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
              method: path === "items" ? "QUERY" : "GET",
              url: `/collections/${collection.id}/${path}`,
              ...(path === "items"
                ? { payload: { groupId } }
                : { query: { groupId } }),
            } as unknown as Parameters<typeof app.inject>[0])
          ).statusCode,
        ).toBe(400)
      }
    },
  )

  it.each([
    [{ ratingMin: 7.5 }, [0, 1]],
    [{ ratingMax: 8.25 }, [0, 1]],
    [{ ratingMin: 7.5, ratingMax: 7.5 }, [0]],
    [{ ratingMin: 8.25, ratingMax: 8.25 }, [1]],
    [{ ratingMin: 7.6, ratingMax: 8.25 }, [1]],
    [{ ratingMin: 1, ratingMax: 10 }, [0, 1]],
    [{ ratingMin: 9 }, []],
    [{ ratingMax: 7.4 }, []],
  ] satisfies Array<[Record<string, number>, number[]]>)(
    "фильтрует гостевую выдачу по общей оценке с включительными границами: %s",
    async (query, indexes) => {
      const { app, connection } = getTestApplication()
      const { collection, first, second, owner } = await createCollection()
      await connection.collection("ItemMetric").insertMany([
        { item: first._id, ratingAverage: 7.5 },
        { item: second._id, ratingAverage: 8.25 },
        { item: new Types.ObjectId(), ratingAverage: 9 },
      ])
      await connection.collection("UserItem").insertMany([
        {
          user: owner.user._id,
          item: first._id,
          status: "blocked",
          rating: 10,
          isFavorite: true,
          note: "Приватно",
          attempts: [],
        },
        {
          user: owner.user._id,
          item: second._id,
          status: "planned",
          rating: 1,
          isFavorite: false,
          attempts: [],
        },
      ])
      const url = "/collections/" + collection.id + "/items"
      const guest = await app.inject({
        method: "QUERY",
        url,
        payload: query,
      } as unknown as Parameters<typeof app.inject>[0])
      const signedIn = await app.inject({
        method: "QUERY",
        url,
        payload: query,
        headers: owner.headers,
      } as unknown as Parameters<typeof app.inject>[0])
      expect(guest.statusCode).toBe(200)
      expect(signedIn.statusCode).toBe(200)
      expect(signedIn.json()).toEqual(guest.json())
      const body = guest.json<{
        total: number
        items: Array<{ id: string }>
        displayBlocks: Array<{ type: string }>
      }>()
      expect(body.total).toBe(indexes.length)
      expect(body.items.map((item) => item.id)).toEqual(
        indexes.map((index) => [first, second][index]?._id.toHexString()),
      )
      expect(body.displayBlocks.every((block) => block.type === "group")).toBe(
        true,
      )
      for (const item of body.items) {
        expect(item).not.toHaveProperty("userItem")
      }
    },
  )

  it.each([undefined, null])(
    "не подменяет неизвестную общую оценку %s личной оценкой и сохраняет Item без фильтра",
    async (average) => {
      const { app, connection } = getTestApplication()
      const { collection, first, second, owner } = await createCollection()
      await connection
        .collection("ItemMetric")
        .insertOne({ item: second._id, ratingAverage: 8 })
      if (average === null) {
        await connection
          .collection("ItemMetric")
          .insertOne({ item: first._id, ratingAverage: null })
      }
      await connection.collection("UserItem").insertOne({
        user: owner.user._id,
        item: first._id,
        status: "planned",
        rating: 10,
        isFavorite: false,
        attempts: [],
      })
      const base = "/collections/" + collection.id + "/items"
      const unfiltered = await app.inject({
        method: "QUERY",
        url: base,
        payload: { mode: "flat" },
      } as unknown as Parameters<typeof app.inject>[0])
      expect(unfiltered.statusCode).toBe(200)
      expect(unfiltered.json()).toMatchObject({
        total: 2,
        items: [
          { id: first._id.toHexString() },
          { id: second._id.toHexString() },
        ],
      })
      for (const query of [
        { ratingMin: 1 },
        { ratingMax: 10 },
        { ratingMin: 1, ratingMax: 10 },
      ]) {
        const response = await app.inject({
          method: "QUERY",
          url: base,
          payload: { mode: "flat", ...query },
          headers: owner.headers,
        } as unknown as Parameters<typeof app.inject>[0])
        expect(response.statusCode).toBe(200)
        expect(response.json()).toMatchObject({
          total: 1,
          items: [{ id: second._id.toHexString() }],
        })
      }
    },
  )

  it("считает total и страницы после фильтра общей оценки и совмещает его с поиском и группой", async () => {
    const { app, connection } = getTestApplication()
    const { collection, first, second, secondGroupId } =
      await createCollection()
    await connection.collection("ItemMetric").insertMany([
      { item: first._id, ratingAverage: 7.5 },
      { item: second._id, ratingAverage: 8.25 },
    ])
    const base = "/collections/" + collection.id + "/items"
    const payload = { mode: "flat", ratingMin: 7.5, ratingMax: 8.25, limit: 1 }
    const secondPage = await app.inject({
      method: "QUERY",
      url: base,
      payload: { ...payload, page: 2 },
    } as unknown as Parameters<typeof app.inject>[0])
    expect(secondPage.statusCode).toBe(200)
    expect(secondPage.json()).toMatchObject({
      total: 2,
      pages: 2,
      page: 2,
      isPreviousPage: true,
      isNextPage: false,
      items: [{ id: second._id.toHexString() }],
    })
    const filtered = await app.inject({
      method: "QUERY",
      url: base,
      payload: { ...payload, groupId: secondGroupId, query: "Beta" },
    } as unknown as Parameters<typeof app.inject>[0])
    expect(filtered.statusCode).toBe(200)
    expect(filtered.json()).toMatchObject({
      total: 1,
      pages: 1,
      items: [{ id: second._id.toHexString() }],
    })
    const narrowedBase = "/collections/" + collection.id + "/items"
    const narrowedPayload = { mode: "flat", ratingMin: 8, limit: 1 }
    const narrowed = await app.inject({
      method: "QUERY",
      url: narrowedBase,
      payload: narrowedPayload,
    } as unknown as Parameters<typeof app.inject>[0])
    expect(narrowed.statusCode).toBe(200)
    expect(narrowed.json()).toMatchObject({
      total: 1,
      pages: 1,
      page: 1,
      isPreviousPage: false,
      isNextPage: false,
      items: [{ id: second._id.toHexString() }],
    })
    const narrowedNext = await app.inject({
      method: "QUERY",
      url: narrowedBase,
      payload: { ...narrowedPayload, page: 2 },
    } as unknown as Parameters<typeof app.inject>[0])
    expect(narrowedNext.statusCode).toBe(200)
    expect(narrowedNext.json()).toMatchObject({ total: 1, pages: 1, items: [] })
    const pastLastPage = await app.inject({
      method: "QUERY",
      url: base,
      payload: { ...payload, page: 3 },
    } as unknown as Parameters<typeof app.inject>[0])
    expect(pastLastPage.statusCode).toBe(200)
    expect(pastLastPage.json()).toMatchObject({ total: 2, pages: 2, items: [] })
  })

  it.each([
    "planned",
    "inProgress",
    "onHold",
    "completed",
    "dropped",
    "skipped",
    "blocked",
    "expiredSkip",
  ])(
    "не меняет публичный состав и не раскрывает личную запись в состоянии %s",
    async (state) => {
      const { app, connection } = getTestApplication()
      const { collection, first, owner } = await createCollection()
      const url = "/collections/" + collection.id + "/items"
      const before = await app.inject({
        method: "QUERY",
        url,
        payload: {},
      } as unknown as Parameters<typeof app.inject>[0])
      expect(before.statusCode).toBe(200)
      const isSkipped = state === "skipped" || state === "expiredSkip"
      await connection.collection("UserItem").insertOne({
        user: owner.user._id,
        item: first._id,
        status: isSkipped ? "skipped" : state,
        rating: isSkipped ? null : 9,
        isFavorite: !isSkipped,
        note: isSkipped ? null : "Приватная заметка",
        attempts: isSkipped
          ? []
          : [
              {
                id: new Types.ObjectId(),
                isCompleted: false,
                progress: 65,
                unit: "percent",
                startedAt: null,
                completedAt: null,
              },
            ],
        expiresAt: isSkipped
          ? new Date(
              Date.now() + (state === "expiredSkip" ? -60_000 : 86_400_000),
            )
          : null,
      })
      const response = await app.inject({
        method: "QUERY",
        url,
        headers: owner.headers,
        payload: {},
      } as unknown as Parameters<typeof app.inject>[0])
      expect(response.statusCode).toBe(200)
      expect(response.json()).toEqual(before.json())
      expect(response.body).not.toContain("userItem")
      expect(response.body).not.toContain("Приватная заметка")
      expect(response.body).not.toContain("attempts")
    },
  )
})
