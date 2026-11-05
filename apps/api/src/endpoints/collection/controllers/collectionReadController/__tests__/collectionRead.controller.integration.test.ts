import { describe, expect, it } from "@jest/globals"
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger"
import { Types } from "mongoose"
import { createCollection } from "@endpoints/collection/__tests__/functions/createCollection"
import { getTestApplication } from "@app/__tests__/setup/setupIntegration"
import { ItemRepository } from "@entities/item/services/itemRepository"
import { EItemType } from "@entities/item/schemas/EItemType"
import type { ItemCollectionsResponseDto } from "@endpoints/collection/services/collectionContentService"

describe("CollectionReadController HTTP", () => {
  const query = (
    id: string,
    payload: object = {},
    headers?: Record<string, string>,
  ) => {
    const { app } = getTestApplication()
    return app.inject({
      method: "QUERY",
      url: "/collections/" + id + "/items",
      payload,
      headers,
    } as unknown as Parameters<typeof app.inject>[0])
  }

  it("возвращает метаданные и данные автора без состава и личной реакции", async () => {
    const { app } = getTestApplication()
    const { collection, owner, firstGroupId, textId, secondGroupId } =
      await createCollection()
    const response = await app.inject({
      method: "GET",
      url: "/collections/" + collection.id,
      headers: { cookie: "__Host-accessToken=invalid" },
    })
    expect(response.statusCode).toBe(200)
    expect(response.headers["cache-control"]).toBe("no-store")
    expect(response.json()).toMatchObject({
      author: {
        id: owner.user._id.toHexString(),
        avatar: null,
        displayName: owner.user.displayName,
      },
      blocks: [{ id: firstGroupId }, { id: textId }, { id: secondGroupId }],
    })
    expect(response.json()).not.toHaveProperty("authorId")
    expect(response.json()).not.toHaveProperty("items")
    expect(response.json()).not.toHaveProperty("isFavorite")
  })

  it("возвращает автора null у подборки сайта", async () => {
    const { app, connection } = getTestApplication()
    const { collection } = await createCollection()
    await connection
      .collection("Collection")
      .updateOne(
        { _id: new Types.ObjectId(collection.id) },
        { $set: { author: null } },
      )
    const response = await app.inject({
      method: "GET",
      url: "/collections/" + collection.id,
    })
    expect(response.statusCode).toBe(200)
    expect(response.json()).toHaveProperty("author", null)
  })

  it("возвращает только блоки и курсор, одинаково для гостя и владельца", async () => {
    const { collection, first, second, owner } = await createCollection()
    const response = await query(collection.id)
    expect(response.statusCode).toBe(200)
    expect(response.headers["accept-query"]).toBe("application/json")
    expect(response.headers["cache-control"]).toBe("no-store")
    expect(response.json()).toEqual({
      nextCursor: false,
      blocks: [
        {
          type: "group",
          title: null,
          description: null,
          items: [
            {
              id: first._id.toHexString(),
              type: "movie",
              title: { ru: "Альфа", en: "Alpha" },
              media: [],
              note: "Заметка",
            },
          ],
        },
        { type: "text", content: { ru: "Текст", en: null } },
        {
          type: "group",
          title: { ru: "Группа", en: null },
          description: null,
          items: [
            {
              id: second._id.toHexString(),
              type: "movie",
              title: { ru: "Бета", en: "Beta" },
              media: [],
              note: null,
            },
          ],
        },
      ],
    })
    expect((await query(collection.id, {}, owner.headers)).json()).toEqual(
      response.json(),
    )
  })

  it("подгружает состав без пропусков, исключает удалённые Item и не повторяет текст", async () => {
    const { app, connection } = getTestApplication()
    const { collection, firstGroupId, first, second } = await createCollection()
    const extra = []
    for (let index = 0; index < 10; index += 1) {
      const item = await app.get(ItemRepository).write.create({
        type: EItemType.MOVIE,
        title: { ru: "Фильм " + index, en: null },
      })
      extra.push(item._id)
      await connection.collection("ItemCollection").insertOne({
        collectionId: new Types.ObjectId(collection.id),
        groupId: new Types.ObjectId(firstGroupId),
        item: item._id,
        position: index + 2,
        note: null,
      })
    }
    await connection
      .collection("Item")
      .updateOne({ _id: extra[2] }, { $set: { deletedAt: new Date() } })
    const firstResponse = await query(collection.id, { limit: 10 })
    expect(firstResponse.statusCode).toBe(200)
    const firstPage = firstResponse.json<ItemCollectionsResponseDto>()
    expect(firstPage.nextCursor).toEqual(expect.any(String))
    expect(
      firstPage.blocks.flatMap((block) =>
        block.type === "group" ? block.items.map(({ id }) => id) : [],
      ),
    ).toEqual(
      [first._id, ...extra.filter((_item, index) => index !== 2)].map(
        (itemId) => itemId.toHexString(),
      ),
    )
    const response = await query(collection.id, {
      cursor: firstPage.nextCursor,
      limit: 10,
    })
    expect(response.statusCode).toBe(200)
    const page = response.json<ItemCollectionsResponseDto>()
    expect(page.nextCursor).toBe(false)
    expect(page.blocks).toMatchObject([
      { type: "text", content: { ru: "Текст" } },
      { type: "group", items: [{ id: second._id.toHexString() }] },
    ])
    await connection
      .collection("Collection")
      .updateOne(
        { _id: new Types.ObjectId(collection.id) },
        { $inc: { version: 1 } },
      )
    expect(
      (await query(collection.id, { cursor: firstPage.nextCursor })).statusCode,
    ).toBe(400)
  })

  it("публикует в OpenAPI только новый контракт состава", () => {
    const { app } = getTestApplication()
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().setOpenAPIVersion("3.2.0").build(),
    )
    expect(document.paths["/collections"]?.query).toBeUndefined()
    expect(document.paths["/collections/{id}/filters"]).toBeUndefined()
    expect(
      document.paths["/collections/{id}/items"]?.query?.responses?.["200"],
    ).toMatchObject({
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/ItemCollectionsResponseDto" },
        },
      },
    })
    expect(
      document.components?.schemas?.ItemCollectionsResponseDto,
    ).toMatchObject({ required: ["nextCursor", "blocks"] })
    expect(
      document.components?.schemas?.ItemCollectionsResponseDto,
    ).not.toHaveProperty("properties.items")
  })

  it("возвращает 404 для удалённых маршрутов и 400 для старых полей запроса", async () => {
    const { app } = getTestApplication()
    const { collection } = await createCollection()
    const oldQuery = {
      method: "QUERY",
      url: "/collections",
      payload: {},
    } as unknown as Parameters<typeof app.inject>[0]
    expect((await app.inject(oldQuery)).statusCode).toBe(404)
    expect(
      (
        await app.inject({
          method: "GET",
          url: "/collections/" + collection.id + "/filters",
        })
      ).statusCode,
    ).toBe(404)
    for (const payload of [
      { page: 1 },
      { mode: "flat" },
      { sort: "title" },
      { tags: [] },
      { cursor: "YWJj" },
    ]) {
      expect((await query(collection.id, payload)).statusCode).toBe(400)
    }
  })

  it("различает неверный ID, отсутствующую и удалённую подборку", async () => {
    const { app, connection } = getTestApplication()
    const { collection } = await createCollection()
    expect((await query("invalid")).statusCode).toBe(400)
    expect((await query(new Types.ObjectId().toHexString())).statusCode).toBe(
      404,
    )
    await connection
      .collection("Collection")
      .updateOne(
        { _id: new Types.ObjectId(collection.id) },
        { $set: { deletedAt: new Date() } },
      )
    expect((await query(collection.id)).statusCode).toBe(404)
    expect(
      (
        await app.inject({
          method: "GET",
          url: "/collections/" + collection.id,
        })
      ).statusCode,
    ).toBe(404)
  })
})
