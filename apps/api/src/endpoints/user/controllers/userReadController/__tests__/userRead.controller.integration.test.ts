import { describe, expect, it } from "@jest/globals"
import { Types } from "mongoose"

import { getTestApplication } from "@app/__tests__/setup/setupIntegration"
import { createAccount } from "@endpoints/account/__tests__/functions/createAccount"
import type { UserLibraryResponseDto } from "@endpoints/user/services/userLibraryService"
import { EItemType } from "@entities/item/schemas/EItemType"
import { ItemRepository } from "@entities/item/services/itemRepository"
import { EUserItemStatus } from "@entities/userItem/schemas/EUserItemStatus"

describe("UserReadController", () => {
  const libraryUrl = (id: Types.ObjectId) =>
    `/users/${id.toHexString()}/library`

  const query = (
    user: Types.ObjectId,
    payload: object,
    headers?: Record<string, string>,
  ) =>
    getTestApplication().app.inject({
      method: "QUERY",
      url: libraryUrl(user),
      payload,
      headers,
    })

  it("отклоняет QUERY библиотеки без тела и с устаревшим фильтром по ID", async () => {
    const { app } = getTestApplication()
    const { user, headers } = await createAccount()
    const missing = await app.inject({
      method: "QUERY",
      url: libraryUrl(user._id),
      headers,
    })
    expect(missing.statusCode).toBe(400)
    expect(missing.json()).toMatchObject({ error: { code: "BAD_REQUEST" } })
    expect(
      (
        await query(
          user._id,
          { ids: [new Types.ObjectId().toHexString()] },
          headers,
        )
      ).statusCode,
    ).toBe(400)
  })

  it("показывает ID записи и краткий прогресс только владельцу с действующей сессией", async () => {
    const { app, connection } = getTestApplication()
    const owner = await createAccount()
    const other = await createAccount()
    const item = await app.get(ItemRepository).write.create({
      type: EItemType.MOVIE,
      title: { ru: "Фильм", en: null },
    })
    const entryId = new Types.ObjectId()
    await connection.collection("UserItem").insertMany([
      {
        _id: entryId,
        user: owner.user._id,
        item: item._id,
        status: EUserItemStatus.IN_PROGRESS,
        rating: 8,
        isFavorite: true,
        note: "Личная заметка",
        attempts: [
          { progress: 10, unit: "minute" },
          { progress: 35, unit: "minute" },
        ],
      },
      {
        user: other.user._id,
        item: item._id,
        status: EUserItemStatus.PLANNED,
        isFavorite: false,
        attempts: [],
      },
    ])
    const publicCard = {
      id: item._id.toHexString(),
      type: EItemType.MOVIE,
      title: { ru: "Фильм", en: null },
      media: [],
      status: EUserItemStatus.IN_PROGRESS,
      rating: 8,
      ratingAverage: null,
      movieDuration: null,
      isFavorite: true,
      userItemId: null,
      progress: null,
    }
    const personal = await query(owner.user._id, {}, owner.headers)
    expect(personal.statusCode).toBe(200)
    expect(personal.headers["accept-query"]).toBe("application/json")
    expect(personal.headers["cache-control"]).toBe("no-store")
    expect(personal.json()).toEqual({
      items: [
        {
          ...publicCard,
          userItemId: entryId.toHexString(),
          progress: { value: 35, unit: "minute" },
        },
      ],
      nextCursor: null,
    })

    for (const headers of [
      undefined,
      other.headers,
      { cookie: "__Host-accessToken=invalid" },
    ]) {
      const response = await query(owner.user._id, {}, headers)
      expect(response.statusCode).toBe(200)
      expect(response.json()).toEqual({ items: [publicCard], nextCursor: null })
    }
    const sessions = connection.collection("UserSession")
    await sessions.deleteOne({ _id: owner.session._id })
    const revoked = await query(owner.user._id, {}, owner.headers)
    expect(revoked.statusCode).toBe(200)
    expect(revoked.json()).toEqual({ items: [publicCard], nextCursor: null })

    await sessions.insertOne({
      ...owner.session,
      expiresAt: new Date(Date.now() - 1000),
    })
    const expired = await query(owner.user._id, {}, owner.headers)
    expect(expired.statusCode).toBe(200)
    expect(expired.json()).toEqual({ items: [publicCard], nextCursor: null })
    expect(await connection.collection("UserItem").countDocuments()).toBe(2)
  })

  it("возвращает библиотеку без пропусков и исключает скрытые статусы и недоступные произведения", async () => {
    const { app, connection } = getTestApplication()
    const { user } = await createAccount()
    const items = await app.get(ItemRepository).bulk.createMany(
      Array.from({ length: 15 }, (_item, index) => ({
        type: EItemType.MOVIE,
        title: { ru: String(index).padStart(2, "0"), en: null },
      })),
    )
    const visibleItems = items.slice(0, 11)
    const [activeSkip, expiredSkip, blocked, deleted] = items.slice(11)
    await connection
      .collection("Item")
      .updateOne({ _id: deleted._id }, { $set: { deletedAt: new Date() } })
    const planned = [...visibleItems, deleted].map(({ _id }) => ({
      item: _id,
      status: EUserItemStatus.PLANNED,
    }))
    await connection.collection("UserItem").insertMany(
      [
        ...planned,
        { item: new Types.ObjectId(), status: EUserItemStatus.PLANNED },
        { item: blocked._id, status: EUserItemStatus.BLOCKED },
        {
          item: activeSkip._id,
          status: EUserItemStatus.SKIPPED,
          expiresAt: new Date(Date.now() + 60_000),
        },
        {
          item: expiredSkip._id,
          status: EUserItemStatus.SKIPPED,
          expiresAt: new Date(Date.now() - 1000),
        },
      ].map((record) => ({
        user: user._id,
        isFavorite: false,
        attempts: [],
        ...record,
      })),
    )
    const body = { limit: 10, sort: "title" }
    const first = await query(user._id, body)
    expect(first.statusCode).toBe(200)
    const page = first.json<UserLibraryResponseDto>()
    const ids = visibleItems.map(({ _id }) => _id.toHexString())
    expect(page.items.map(({ id }) => id)).toEqual(ids.slice(0, 10))
    expect(page.nextCursor).toEqual(expect.any(String))
    const second = await query(user._id, { ...body, cursor: page.nextCursor })
    expect(second.statusCode).toBe(200)
    const continuation = second.json<UserLibraryResponseDto>()
    expect(continuation.items.map(({ id }) => id)).toEqual(ids.slice(10))
    expect(continuation.nextCursor).toBeNull()
  })

  it("различает пустую библиотеку и отсутствующего пользователя без создания записей", async () => {
    const { user } = await createAccount()
    const response = await query(user._id, {})
    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ items: [], nextCursor: null })
    expect((await query(new Types.ObjectId(), {})).statusCode).toBe(404)
    expect(
      await getTestApplication()
        .connection.collection("UserItem")
        .countDocuments(),
    ).toBe(0)
  })

  it("разрешает CORS preflight для QUERY и отклоняет посторонний origin", async () => {
    const { app } = getTestApplication()
    const { user } = await createAccount()
    const preflight = await app.inject({
      method: "OPTIONS",
      url: libraryUrl(user._id),
      headers: {
        origin: "http://localhost",
        "access-control-request-method": "QUERY",
        "access-control-request-headers": "content-type",
      },
    })
    expect(preflight.statusCode).toBe(204)
    expect(preflight.headers["access-control-allow-methods"]).toContain("QUERY")
    expect(preflight.headers["access-control-allow-credentials"]).toBe("true")
    expect(
      (await query(user._id, {}, { origin: "https://untrusted.example" }))
        .statusCode,
    ).toBe(403)
  })
})
