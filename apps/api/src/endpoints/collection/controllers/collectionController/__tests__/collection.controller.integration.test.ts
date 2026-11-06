import { describe, expect, it } from "@jest/globals"
import sharp from "sharp"
import { ItemRepository } from "@entities/item/services/itemRepository"
import { EItemType } from "@entities/item/schemas/EItemType"
import { StorageService } from "@infrastructure/storage/services/storageService"
import { Types } from "mongoose"

import type { Collection } from "@entities/collection/schemas/collection.schema"
import type { ItemCollection } from "@entities/itemCollection/schemas/itemCollection.schema"
import { ECollectionBlockType } from "@entities/collection/schemas/ECollectionBlockType"
import { createAccount } from "@endpoints/account/__tests__/functions/createAccount"
import { getTestApplication } from "@app/__tests__/setup/setupIntegration"

import type { CollectionResponseDto } from "@endpoints/collection/services/collectionService"
import { createCollection } from "@endpoints/collection/__tests__/functions/createCollection"

describe("CollectionController", () => {
  it("отклоняет JSON вместо multipart на маршруте загрузки постера", async () => {
    const { app } = getTestApplication()
    const { owner, collection } = await createCollection()
    const response = await app.inject({
      method: "PUT",
      url: "/collections/" + collection.id + "/poster",
      headers: owner.headers,
      payload: { image: "invalid" },
    })
    expect(response.statusCode).toBe(400)
    expect(response.json()).toMatchObject({ error: { code: "BAD_REQUEST" } })
  })

  it("сохраняет add, update, move и remove блоков и произведений одним запросом", async () => {
    const { app, connection } = getTestApplication()
    const {
      owner,
      collection,
      first,
      second,
      firstGroupId,
      secondGroupId,
      textId,
    } = await createCollection()
    const added = await app.get(ItemRepository).write.create({
      type: EItemType.MOVIE,
      title: { ru: "Новый фильм", en: null },
    })
    const groupId = new Types.ObjectId().toHexString()
    const url = "/collections/" + collection.id
    const response = await app.inject({
      method: "PATCH",
      url,
      headers: owner.headers,
      payload: {
        version: 0,
        blocks: {
          add: [{ id: groupId, type: "group", title: { ru: "Новая группа" } }],
          update: [{ id: textId, content: { ru: "Вступление" } }],
          move: [{ id: groupId, beforeBlockId: textId }],
          remove: [firstGroupId],
        },
        items: {
          add: [{ itemId: added._id.toHexString(), groupId }],
          update: [
            { itemId: first._id.toHexString(), note: "  Новая заметка  " },
          ],
          move: [
            {
              itemId: first._id.toHexString(),
              groupId,
              beforeItemId: added._id.toHexString(),
            },
          ],
          remove: [second._id.toHexString()],
        },
      },
    })
    expect(response.statusCode).toBe(204)
    expect(response.body).toBe("")
    const details = await app.inject({ method: "GET", url })
    expect(details.json()).toMatchObject({
      version: 1,
      blocks: [
        { id: groupId },
        { id: textId, content: { ru: "Вступление" } },
        { id: secondGroupId },
      ],
    })
    expect(
      await connection
        .collection<ItemCollection>("ItemCollection")
        .find({
          collectionId: new Types.ObjectId(collection.id),
        })
        .sort({ position: 1 })
        .toArray(),
    ).toMatchObject([
      {
        item: first._id,
        groupId: new Types.ObjectId(groupId),
        position: 0,
        note: "Новая заметка",
      },
      {
        item: added._id,
        groupId: new Types.ObjectId(groupId),
        position: 1,
        note: null,
      },
    ])
  })

  it("откатывает изменения при ссылке на удаляемый якорь", async () => {
    const { app, connection } = getTestApplication()
    const { owner, collection, first, second, secondGroupId } =
      await createCollection()
    const response = await app.inject({
      method: "PATCH",
      url: "/collections/" + collection.id,
      headers: owner.headers,
      payload: {
        version: 0,
        title: { ru: "Не сохранять" },
        items: {
          move: [
            {
              itemId: first._id.toHexString(),
              groupId: secondGroupId,
              beforeItemId: second._id.toHexString(),
            },
          ],
          remove: [second._id.toHexString()],
        },
      },
    })
    expect(response.statusCode).toBe(400)
    expect(
      await connection
        .collection("Collection")
        .findOne({ _id: new Types.ObjectId(collection.id) }),
    ).toMatchObject({
      version: 0,
      title: { ru: "Подборка" },
    })
    expect(await connection.collection("ItemCollection").countDocuments()).toBe(
      2,
    )
  })

  it("загружает и заменяет обложку автора через multipart", async () => {
    const { app } = getTestApplication()
    const { owner, collection } = await createCollection()
    const outsider = await createAccount()
    const image = await sharp({
      create: { width: 2, height: 2, channels: 3, background: "#123456" },
    })
      .png()
      .toBuffer()
    const boundary = "test-collection-poster"
    const payload = Buffer.concat([
      Buffer.from(
        "--" +
          boundary +
          '\r\nContent-Disposition: form-data; name="file"; filename="poster.png"\r\nContent-Type: image/png\r\n\r\n',
      ),
      image,
      Buffer.from("\r\n--" + boundary + "--\r\n"),
    ])
    const url = "/collections/" + collection.id
    const upload = (headers: Record<string, string>, body = payload) =>
      app.inject({
        method: "PUT",
        url: url + "/poster",
        headers: {
          ...headers,
          "content-type": "multipart/form-data; boundary=" + boundary,
        },
        payload: body,
      })
    expect((await upload(outsider.headers)).statusCode).toBe(404)
    expect(
      (await upload(owner.headers, Buffer.from("--" + boundary + "--\r\n")))
        .statusCode,
    ).toBe(400)
    const first = await upload(owner.headers)
    expect(first.statusCode).toBe(204)
    expect(first.body).toBe("")
    const firstDetails = (
      await app.inject({ method: "GET", url })
    ).json<CollectionResponseDto>()
    const firstPath = new URL(firstDetails.media[0]?.src ?? "").pathname.slice(
      1,
    )
    expect(firstDetails.media).toEqual([
      {
        src: expect.stringContaining(
          "/collections/" + collection.id + "/poster/",
        ),
        type: "poster",
        language: null,
      },
    ])
    expect(await app.get(StorageService).isExists(firstPath)).toBe(true)
    expect((await upload(owner.headers)).statusCode).toBe(204)
    const secondDetails = (
      await app.inject({ method: "GET", url })
    ).json<CollectionResponseDto>()
    expect(secondDetails.media).toHaveLength(1)
    expect(secondDetails.media[0]?.src).not.toBe(firstDetails.media[0]?.src)
    expect(await app.get(StorageService).isExists(firstPath)).toBe(false)
  })

  it("создаёт минимальную подборку с автором из cookie и значениями по умолчанию", async () => {
    const { app, connection } = getTestApplication()
    const { user, headers } = await createAccount()
    const response = await app.inject({
      method: "POST",
      url: "/collections",
      headers,
      payload: { title: { en: "Collection" } },
    })

    expect(response.statusCode).toBe(201)
    expect(response.headers["cache-control"]).toBe("no-store")
    const created = response.json<{ id: string }>()
    expect(created).toEqual({ id: expect.any(String) })
    const read = await app.inject({
      method: "GET",
      url: "/collections/" + created.id,
    })
    expect(read.statusCode).toBe(200)
    const result = read.json<CollectionResponseDto>()
    expect(result).toEqual({
      id: expect.any(String),
      author: {
        id: user._id.toHexString(),
        avatar: user.avatarUrl,
        displayName: user.displayName,
      },
      version: 0,
      type: "custom",
      title: { ru: null, en: "Collection" },
      description: { ru: null, en: null },
      blocks: [],
      media: [],
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    })
    expect(
      await connection
        .collection<Collection>("Collection")
        .findOne({ _id: new Types.ObjectId(result.id) }),
    ).toMatchObject({ author: user._id, version: 0, deletedAt: null })
    expect(await connection.collection("ItemCollection").countDocuments()).toBe(
      0,
    )
    expect(await connection.collection("UserItem").countDocuments()).toBe(0)
  })

  it("атомарно создаёт блоки и состав, нормализует заметку без изменения библиотеки", async () => {
    const { connection } = getTestApplication()
    const {
      collection,
      owner,
      first,
      second,
      firstGroupId,
      textId,
      secondGroupId,
    } = await createCollection()
    expect(collection.blocks.map((block) => block.id)).toEqual([
      firstGroupId,
      textId,
      secondGroupId,
    ])
    expect(collection.author?.id).toBe(owner.user._id.toHexString())
    expect(collection).not.toHaveProperty("items")
    const memberships = await connection
      .collection<ItemCollection>("ItemCollection")
      .find({ collectionId: new Types.ObjectId(collection.id) })
      .sort({ position: -1 })
      .toArray()
    expect(memberships).toMatchObject([
      {
        item: first._id,
        groupId: new Types.ObjectId(firstGroupId),
        position: 1,
        note: "Заметка",
      },
      {
        item: second._id,
        groupId: new Types.ObjectId(secondGroupId),
        position: 0,
        note: null,
      },
    ])
    expect(await connection.collection("UserItem").countDocuments()).toBe(0)
  })

  it.each([
    {},
    { title: {} },
    { title: { ru: "   " } },
    { title: { ru: "Тест" }, authorId: "507f1f77bcf86cd799439011" },
    { title: { ru: "Тест" }, type: "invalid" },
    { title: { ru: "Тест" }, blocks: null },
    { title: { ru: "Тест" }, media: [] },
    { title: { ru: "Тест" }, blocks: [{ type: "text", content: {} }] },
    {
      title: { ru: "Тест" },
      blocks: [{ type: "group", content: { ru: "Текст" } }],
    },
    {
      title: { ru: "Тест" },
      blocks: [{ type: "text", content: { ru: "Текст" }, title: null }],
    },
  ])("отклоняет некорректное создание без записи в БД: %j", async (payload) => {
    const { app, connection } = getTestApplication()
    const { headers } = await createAccount()
    const response = await app.inject({
      method: "POST",
      url: "/collections",
      headers,
      payload,
    })
    expect(response.statusCode).toBe(400)
    expect(await connection.collection("Collection").countDocuments()).toBe(0)
    expect(await connection.collection("ItemCollection").countDocuments()).toBe(
      0,
    )
  })

  it.each(["duplicateBlocks", "duplicateItems", "invalidGroup", "missingItem"])(
    "отменяет создание и состав при ошибке %s",
    async (kind) => {
      const { app, connection } = getTestApplication()
      const { owner, body } = await createCollection()
      const group = new Types.ObjectId().toHexString()
      const item = {
        itemId: new Types.ObjectId().toHexString(),
        groupId: group,
        position: 0,
      }
      const blocks = [{ id: group, type: ECollectionBlockType.GROUP }]
      const payload = {
        ...body,
        blocks: kind === "duplicateBlocks" ? [...blocks, ...blocks] : blocks,
        items:
          kind === "duplicateItems"
            ? [item, item]
            : [
                {
                  ...item,
                  groupId:
                    kind === "invalidGroup"
                      ? new Types.ObjectId().toHexString()
                      : group,
                },
              ],
      }
      const response = await app.inject({
        method: "POST",
        url: "/collections",
        headers: owner.headers,
        payload,
      })
      expect(response.statusCode).toBe(kind === "missingItem" ? 404 : 400)
      expect(await connection.collection("Collection").countDocuments()).toBe(1)
      expect(
        await connection.collection("ItemCollection").countDocuments(),
      ).toBe(2)
    },
  )

  it("обновляет метаданные, порядок и состав с версией 0, сохраняя пропущенную заметку", async () => {
    const { app, connection } = getTestApplication()
    const {
      owner,
      collection,
      first,
      second,
      firstGroupId,
      secondGroupId,
      textId,
    } = await createCollection()
    const response = await app.inject({
      method: "PATCH",
      url: `/collections/${collection.id}`,
      headers: owner.headers,
      payload: {
        version: 0,
        title: { en: "Updated" },
        blocks: {
          move: [
            { id: secondGroupId, beforeBlockId: firstGroupId },
            { id: textId, beforeBlockId: firstGroupId },
          ],
        },
        items: {
          move: [
            {
              itemId: first._id.toHexString(),
              groupId: secondGroupId,
              beforeItemId: null,
            },
          ],
          remove: [second._id.toHexString()],
        },
      },
    })
    expect(response.statusCode).toBe(204)
    expect(response.body).toBe("")
    expect(response.headers["cache-control"]).toBe("no-store")
    const read = await app.inject({
      method: "GET",
      url: "/collections/" + collection.id,
    })
    expect(
      read.json<CollectionResponseDto>().blocks.map((block) => block.id),
    ).toEqual([secondGroupId, textId, firstGroupId])
    expect(
      await connection
        .collection<Collection>("Collection")
        .findOne({ _id: new Types.ObjectId(collection.id) }),
    ).toMatchObject({ version: 1, title: { ru: null, en: "Updated" } })
    const memberships = await connection
      .collection<ItemCollection>("ItemCollection")
      .find({ collectionId: new Types.ObjectId(collection.id) })
      .toArray()
    expect(memberships).toHaveLength(1)
    expect(memberships[0]).toMatchObject({
      item: first._id,
      groupId: new Types.ObjectId(secondGroupId),
      position: 0,
      note: "Заметка",
    })
  })

  it("удаляет состав удаляемой группы и добавляет новый блок", async () => {
    const { app, connection } = getTestApplication()
    const { owner, collection, firstGroupId, textId, secondGroupId, first } =
      await createCollection()
    const newId = new Types.ObjectId().toHexString()
    const response = await app.inject({
      method: "PATCH",
      url: `/collections/${collection.id}`,
      headers: owner.headers,
      payload: {
        version: 0,
        blocks: {
          remove: [firstGroupId],
          add: [{ id: newId, type: "group", beforeBlockId: textId }],
        },
      },
    })
    expect(response.statusCode).toBe(204)
    expect(response.body).toBe("")
    const read = await app.inject({
      method: "GET",
      url: "/collections/" + collection.id,
    })
    expect(
      read.json<CollectionResponseDto>().blocks.map((block) => block.id),
    ).toEqual([newId, textId, secondGroupId])
    expect(
      await connection
        .collection("ItemCollection")
        .findOne({ item: first._id }),
    ).toBeNull()
    expect(
      await connection.collection("Item").findOne({ _id: first._id }),
    ).not.toBeNull()
  })

  it.each([
    { version: 0 },
    { title: { ru: "Тест" } },
    { version: -1, media: [] },
    { version: 0.5, media: [] },
    { version: 0, title: null },
    { version: 0, author: null },
    { version: 0, blocks: { move: [] } },
    { version: 0, blocks: null },
    { version: 0, items: { update: [{}] } },
    { version: 0, blocks: { add: [{ type: "group", id: "invalid" }] } },
  ])(
    "отклоняет некорректное обновление без изменения БД: %j",
    async (payload) => {
      const { app, connection } = getTestApplication()
      const { collection, owner } = await createCollection()
      const before = await connection
        .collection("Collection")
        .findOne({ _id: new Types.ObjectId(collection.id) })
      const response = await app.inject({
        method: "PATCH",
        url: `/collections/${collection.id}`,
        headers: owner.headers,
        payload,
      })
      expect(response.statusCode).toBe(400)
      expect(
        await connection
          .collection("Collection")
          .findOne({ _id: new Types.ObjectId(collection.id) }),
      ).toEqual(before)
    },
  )

  it("при конфликте версии не меняет метаданные и состав", async () => {
    const { app, connection } = getTestApplication()
    const { collection, owner, first } = await createCollection()
    const response = await app.inject({
      method: "PATCH",
      url: `/collections/${collection.id}`,
      headers: owner.headers,
      payload: {
        version: 1,
        title: { ru: "Нельзя" },
        items: { remove: [first._id.toHexString()] },
      },
    })
    expect(response.statusCode).toBe(409)
    expect(
      await connection
        .collection<Collection>("Collection")
        .findOne({ _id: new Types.ObjectId(collection.id) }),
    ).toMatchObject({ version: 0, title: { ru: "Подборка" } })
    expect(await connection.collection("ItemCollection").countDocuments()).toBe(
      2,
    )
  })

  it("при параллельном PATCH одной версии сохраняет только одно изменение", async () => {
    const { app, connection } = getTestApplication()
    const { collection, owner } = await createCollection()
    const responses = await Promise.all(
      ["Первый", "Второй"].map(async (title) => {
        return app.inject({
          method: "PATCH",
          url: `/collections/${collection.id}`,
          headers: owner.headers,
          payload: { version: 0, title: { ru: title } },
        })
      }),
    )
    expect(responses.map((response) => response.statusCode).sort()).toEqual([
      204, 409,
    ])
    const success = responses.findIndex(
      (response) => response.statusCode === 204,
    )
    expect(responses[success]?.body).toBe("")
    expect(
      await connection
        .collection<Collection>("Collection")
        .findOne({ _id: new Types.ObjectId(collection.id) }),
    ).toMatchObject({
      version: 1,
      title: { ru: ["Первый", "Второй"][success] },
    })
  })

  it("считает отсутствующую сохранённую версию нулевой и обновляет её до 1", async () => {
    const { app, connection } = getTestApplication()
    const { collection, owner } = await createCollection()
    await connection
      .collection("Collection")
      .updateOne(
        { _id: new Types.ObjectId(collection.id) },
        { $unset: { version: "" } },
      )
    const response = await app.inject({
      method: "PATCH",
      url: `/collections/${collection.id}`,
      headers: owner.headers,
      payload: { version: 0, media: [] },
    })
    expect(response.statusCode).toBe(204)
    expect(response.body).toBe("")
    expect(
      await connection
        .collection("Collection")
        .findOne({ _id: new Types.ObjectId(collection.id) }),
    ).toMatchObject({ version: 1 })
  })

  it("возвращает конфликт при достижении предельной версии", async () => {
    const { app, connection } = getTestApplication()
    const { collection, owner } = await createCollection()
    await connection
      .collection("Collection")
      .updateOne(
        { _id: new Types.ObjectId(collection.id) },
        { $set: { version: Number.MAX_SAFE_INTEGER } },
      )
    const response = await app.inject({
      method: "PATCH",
      url: `/collections/${collection.id}`,
      headers: owner.headers,
      payload: { version: Number.MAX_SAFE_INTEGER, title: { ru: "Нельзя" } },
    })
    expect(response.statusCode).toBe(409)
    expect(
      await connection
        .collection("Collection")
        .findOne({ _id: new Types.ObjectId(collection.id) }),
    ).toMatchObject({
      version: Number.MAX_SAFE_INTEGER,
      title: { ru: "Подборка" },
    })
  })

  it.each(["PATCH", "DELETE"] as const)(
    "запрещает изменение подборки сайта и удалённой подборки при %s",
    async (method) => {
      const { app, connection } = getTestApplication()
      const { collection, owner } = await createCollection()
      for (const changes of [
        { author: null },
        { author: owner.user._id, deletedAt: new Date() },
      ]) {
        await connection
          .collection("Collection")
          .updateOne(
            { _id: new Types.ObjectId(collection.id) },
            { $set: changes },
          )
        const response = await app.inject({
          method,
          url: `/collections/${collection.id}`,
          headers: owner.headers,
          ...(method === "PATCH" ? { payload: { version: 0, media: [] } } : {}),
        })
        expect(response.statusCode).toBe(404)
      }
    },
  )

  it.each([null, "   "])("явно очищает заметку значением %j", async (note) => {
    const { app, connection } = getTestApplication()
    const { collection, owner, first } = await createCollection()
    const response = await app.inject({
      method: "PATCH",
      url: `/collections/${collection.id}`,
      headers: owner.headers,
      payload: {
        version: 0,
        items: { update: [{ itemId: first._id.toHexString(), note }] },
      },
    })
    expect(response.statusCode).toBe(204)
    expect(response.body).toBe("")
    expect(
      await connection.collection("ItemCollection").findOne({
        collectionId: new Types.ObjectId(collection.id),
        item: first._id,
      }),
    ).toMatchObject({ note: null })
  })

  it("при отсутствующем Item откатывает обновление подборки", async () => {
    const { app, connection } = getTestApplication()
    const { collection, owner, firstGroupId } = await createCollection()
    const response = await app.inject({
      method: "PATCH",
      url: `/collections/${collection.id}`,
      headers: owner.headers,
      payload: {
        version: 0,
        title: { ru: "Нельзя" },
        items: {
          add: [
            {
              itemId: new Types.ObjectId().toHexString(),
              groupId: firstGroupId,
            },
          ],
        },
      },
    })
    expect(response.statusCode).toBe(404)
    expect(
      await connection
        .collection<Collection>("Collection")
        .findOne({ _id: new Types.ObjectId(collection.id) }),
    ).toMatchObject({ version: 0, title: { ru: "Подборка" } })
    expect(await connection.collection("ItemCollection").countDocuments()).toBe(
      2,
    )
  })

  it.each(["PATCH", "DELETE"] as const)(
    "возвращает 404 для чужой подборки при %s",
    async (method) => {
      const { app, connection } = getTestApplication()
      const { collection } = await createCollection()
      const { headers } = await createAccount()
      const response = await app.inject({
        method,
        url: `/collections/${collection.id}`,
        headers,
        ...(method === "PATCH" ? { payload: { version: 0, media: [] } } : {}),
      })
      expect(response.statusCode).toBe(404)
      expect(
        await connection
          .collection<Collection>("Collection")
          .findOne({ _id: new Types.ObjectId(collection.id) }),
      ).toMatchObject({ version: 0, deletedAt: null })
    },
  )

  it("мягко удаляет подборку, сохраняя Item, состав и реакции, повторное удаление возвращает 404", async () => {
    const { app, connection } = getTestApplication()
    const { collection, owner } = await createCollection()
    const favorite = await app.inject({
      method: "PATCH",
      url: `/collections/${collection.id}/user`,
      headers: owner.headers,
      payload: { isFavorite: true },
    })
    expect(favorite.statusCode).toBe(204)
    const response = await app.inject({
      method: "DELETE",
      url: `/collections/${collection.id}`,
      headers: owner.headers,
    })
    expect(response.statusCode).toBe(204)
    expect(response.body).toBe("")
    expect(response.headers["cache-control"]).toBe("no-store")
    expect(
      await connection
        .collection<Collection>("Collection")
        .findOne({ _id: new Types.ObjectId(collection.id) }),
    ).toMatchObject({ deletedAt: expect.any(Date) })
    expect(await connection.collection("ItemCollection").countDocuments()).toBe(
      2,
    )
    expect(await connection.collection("Item").countDocuments()).toBe(2)
    expect(await connection.collection("UserCollection").countDocuments()).toBe(
      1,
    )
    expect(
      (
        await app.inject({
          method: "DELETE",
          url: `/collections/${collection.id}`,
          headers: owner.headers,
        })
      ).statusCode,
    ).toBe(404)
  })

  it.each(["POST", "PATCH", "DELETE"] as const)(
    "проверяет авторизацию, CSRF и ObjectId для %s",
    async (method) => {
      const { app } = getTestApplication()
      const { collection, owner } = await createCollection()
      const url =
        method === "POST" ? "/collections" : `/collections/${collection.id}`
      const payload =
        method === "POST"
          ? { title: { ru: "Тест" } }
          : method === "PATCH"
            ? { version: 0, media: [] }
            : undefined
      expect(
        (
          await app.inject({
            method,
            url,
            headers: { origin: "http://localhost" },
            payload,
          })
        ).statusCode,
      ).toBe(401)
      expect(
        (
          await app.inject({
            method,
            url,
            headers: { ...owner.headers, origin: "https://evil.example" },
            payload,
          })
        ).statusCode,
      ).toBe(403)
      if (method !== "POST") {
        expect(
          (
            await app.inject({
              method,
              url: "/collections/invalid",
              headers: owner.headers,
              payload,
            })
          ).statusCode,
        ).toBe(400)
        expect(
          (
            await app.inject({
              method,
              url: `/collections/${new Types.ObjectId().toHexString()}`,
              headers: owner.headers,
              payload,
            })
          ).statusCode,
        ).toBe(404)
      }
    },
  )
})
