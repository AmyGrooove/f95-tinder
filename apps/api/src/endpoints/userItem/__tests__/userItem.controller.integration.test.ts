import { describe, expect, it, jest } from "@jest/globals"
import { Types } from "mongoose"

import { createAccount } from "@endpoints/account/__tests__/functions/createAccount"
import { EItemType } from "@entities/item/schemas/EItemType"
import { ItemRepository } from "@entities/item/services/item.repository"
import type { Item } from "@entities/item/schemas/item.schema"
import type { User } from "@entities/user/schemas/user.schema"
import type { Session } from "@entities/session/schemas/session.schema"
import { EUserItemStatus } from "@entities/userItem/schemas/EUserItemStatus"
import type { UserItem } from "@entities/userItem/schemas/userItem.schema"
import { UserItemRepository } from "@entities/userItem/services/userItem.repository"
import { getTestApplication } from "@test/setup/setupIntegration"

import type { UserItemResponseDto } from "../dto/response/userItem.response"

describe("UserItemController HTTP", () => {
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

  const createItem = async () => {
    return getTestApplication()
      .app.get(ItemRepository)
      .write.create({
        type: EItemType.MOVIE,
        title: { ru: "Тестовый фильм", en: null },
      })
  }

  const createEntry = async (
    status: EUserItemStatus = EUserItemStatus.PLANNED,
  ) => {
    const account = await createAccount()
    const item = await createItem()
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

  it("сохраняет запланированное произведение с обязательным статусом и значениями по умолчанию", async () => {
    const { entry, item, user } = await createEntry()

    expect(entry).toEqual({
      id: expect.stringMatching(/^[a-f0-9]{24}$/),
      itemId: item._id.toHexString(),
      status: EUserItemStatus.PLANNED,
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
      status,
      progress: null,
      unit: "minute",
    })
    const record = await readEntry(entry.id)
    expect(record.attempts[0]?.id).toEqual(
      new Types.ObjectId(entry.attempts[0]?.id),
    )
    expect(record.attempts[0]?.status).toBe(status)
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
      attempts: [{ status: "completed" }],
    })
    expect(await readEntry(entry.id)).toMatchObject({
      status: "completed",
      rating: 9,
      isFavorite: true,
      note: "Пересмотреть",
      attempts: [{ status: "completed" }],
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

  it("начинает, приостанавливает и завершает одну попытку без дублей при повторе статуса", async () => {
    const { app } = getTestApplication()
    const { entry, headers } = await createEntry()
    const start = await app.inject({
      method: "PATCH",
      url: `/userItems/${entry.id}`,
      headers,
      payload: { status: "inProgress" },
    })
    expect(start.statusCode).toBe(200)
    const firstAttempt = start.json<UserItemResponseDto>().attempts[0]
    expect(firstAttempt).toMatchObject({
      status: "inProgress",
      startedAt: expect.any(String),
      completedAt: null,
    })
    let previous = await readEntry(entry.id)
    expect(previous).toMatchObject({
      status: "inProgress",
      attempts: [
        {
          id: new Types.ObjectId(firstAttempt?.id),
          status: "inProgress",
          startedAt: new Date(firstAttempt?.startedAt ?? ""),
          completedAt: null,
        },
      ],
    })

    for (const status of [
      "inProgress",
      "onHold",
      "inProgress",
      "completed",
      "completed",
    ]) {
      const response = await app.inject({
        method: "PATCH",
        url: `/userItems/${entry.id}`,
        headers,
        payload: { status },
      })
      expect(response.statusCode).toBe(200)
      const record = await readEntry(entry.id)
      const completedAt = status === "completed" ? expect.any(Date) : null
      expect(record).toMatchObject({
        status,
        attempts: [
          {
            id: new Types.ObjectId(firstAttempt?.id),
            status,
            startedAt: previous.attempts[0]?.startedAt,
            completedAt,
          },
        ],
      })
      expect(response.json<UserItemResponseDto>()).toMatchObject({
        status,
        attempts: [
          {
            id: firstAttempt?.id,
            status,
            startedAt: firstAttempt?.startedAt,
            completedAt: record.attempts[0]?.completedAt?.toISOString() ?? null,
          },
        ],
      })
      if (previous.status === status) {
        expect(record.attempts).toEqual(previous.attempts)
      }
      previous = record
    }

    const record = await readEntry(entry.id)
    expect(record.status).toBe("completed")
    expect(record.attempts).toHaveLength(1)
    expect(record.attempts[0]).toMatchObject({
      id: new Types.ObjectId(firstAttempt?.id),
      status: "completed",
      startedAt: expect.any(Date),
      completedAt: expect.any(Date),
    })
  })

  it("начинает повторный просмотр с новой попыткой, сохраняя завершённую", async () => {
    const { app } = getTestApplication()
    const { entry, headers } = await createEntry(EUserItemStatus.COMPLETED)
    const before = await readEntry(entry.id)
    const response = await app.inject({
      method: "PATCH",
      url: `/userItems/${entry.id}`,
      headers,
      payload: { status: "inProgress" },
    })

    expect(response.statusCode).toBe(200)
    const record = await readEntry(entry.id)
    expect(record.attempts).toHaveLength(2)
    expect(record.attempts[0]).toEqual(before.attempts[0])
    expect(record.attempts[1]).toMatchObject({
      status: "inProgress",
      completedAt: null,
    })
  })

  it("конфликт статуса откатывает весь общий PATCH, включая оценку и заметку", async () => {
    const { app } = getTestApplication()
    const { entry, headers } = await createEntry(EUserItemStatus.IN_PROGRESS)
    const before = await readEntry(entry.id)
    const response = await app.inject({
      method: "PATCH",
      url: `/userItems/${entry.id}`,
      headers,
      payload: { status: "planned", rating: 10, note: "Изменение" },
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

  it("добавляет прошлую попытку с датами и сохраняет текущий статус и попытку", async () => {
    const { app } = getTestApplication()
    const { entry, headers } = await createEntry(EUserItemStatus.IN_PROGRESS)
    const before = await readEntry(entry.id)
    const response = await app.inject({
      method: "POST",
      url: `/userItems/${entry.id}/attempts`,
      headers,
      payload: {
        status: "completed",
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
      status: "completed",
      progress: 90,
      unit: "minute",
      startedAt: new Date("2026-01-01T10:00:00.000Z"),
      completedAt: new Date("2026-01-01T11:30:00.000Z"),
    })
  })

  it("историческая попытка без дат сохраняется с null и не меняет planned", async () => {
    const { app } = getTestApplication()
    const { entry, headers } = await createEntry()
    const response = await app.inject({
      method: "POST",
      url: `/userItems/${entry.id}/attempts`,
      headers,
      payload: { status: "dropped" },
    })

    expect(response.statusCode).toBe(201)
    expect(await readEntry(entry.id)).toMatchObject({
      status: "planned",
      attempts: [
        {
          status: "dropped",
          progress: null,
          startedAt: null,
          completedAt: null,
        },
      ],
    })
  })

  it("создаёт текущую попытку через POST и синхронизирует статус записи", async () => {
    const { app } = getTestApplication()
    const { entry, headers } = await createEntry()
    const response = await app.inject({
      method: "POST",
      url: `/userItems/${entry.id}/attempts`,
      headers,
      payload: { status: "onHold", progress: 0 },
    })

    expect(response.statusCode).toBe(201)
    expect(await readEntry(entry.id)).toMatchObject({
      status: "onHold",
      attempts: [
        {
          status: "onHold",
          progress: 0,
          startedAt: expect.any(Date),
          completedAt: null,
        },
      ],
    })
  })

  it("изменяет прогресс попытки по стабильному ID и завершает её вместе с записью", async () => {
    const { app } = getTestApplication()
    const { entry, headers } = await createEntry(EUserItemStatus.IN_PROGRESS)
    const attempt = entry.attempts[0]
    const url = `/userItems/${entry.id}/attempts/${attempt?.id}`
    const progress = await app.inject({
      method: "PATCH",
      url,
      headers,
      payload: { progress: 45 },
    })
    expect(progress.statusCode).toBe(200)
    expect(progress.json<UserItemResponseDto>().attempts[0]?.id).toBe(
      attempt?.id,
    )
    const finished = await app.inject({
      method: "PATCH",
      url,
      headers,
      payload: { status: "completed", progress: 90 },
    })

    expect(finished.statusCode).toBe(200)
    expect(await readEntry(entry.id)).toMatchObject({
      status: "completed",
      attempts: [
        {
          id: new Types.ObjectId(attempt?.id),
          status: "completed",
          progress: 90,
          completedAt: expect.any(Date),
        },
      ],
    })
  })

  it("редактирует и очищает историческую попытку без изменения текущего статуса", async () => {
    const { app } = getTestApplication()
    const { entry, headers } = await createEntry(EUserItemStatus.COMPLETED)
    const response = await app.inject({
      method: "PATCH",
      url: `/userItems/${entry.id}/attempts/${entry.attempts[0]?.id}`,
      headers,
      payload: {
        status: "dropped",
        progress: null,
        startedAt: null,
        completedAt: null,
      },
    })

    expect(response.statusCode).toBe(200)
    expect(await readEntry(entry.id)).toMatchObject({
      status: "completed",
      attempts: [
        {
          status: "dropped",
          progress: null,
          startedAt: null,
          completedAt: null,
        },
      ],
    })
  })

  it("не позволяет создать вторую текущую попытку", async () => {
    const { app } = getTestApplication()
    const { entry, headers } = await createEntry(EUserItemStatus.IN_PROGRESS)
    const before = await readEntry(entry.id)
    const response = await app.inject({
      method: "POST",
      url: `/userItems/${entry.id}/attempts`,
      headers,
      payload: { status: "onHold" },
    })

    expect(response.statusCode).toBe(409)
    expect(await readEntry(entry.id)).toEqual(before)
  })

  it("не позволяет возобновить историческую попытку при другой текущей", async () => {
    const { app } = getTestApplication()
    const { entry, headers } = await createEntry(EUserItemStatus.COMPLETED)
    await app.inject({
      method: "POST",
      url: `/userItems/${entry.id}/attempts`,
      headers,
      payload: { status: "inProgress" },
    })
    const before = await readEntry(entry.id)
    const response = await app.inject({
      method: "PATCH",
      url: `/userItems/${entry.id}/attempts/${entry.attempts[0]?.id}`,
      headers,
      payload: { status: "onHold" },
    })

    expect(response.statusCode).toBe(409)
    expect(await readEntry(entry.id)).toEqual(before)
  })

  it.each([
    {
      status: "completed",
      startedAt: "2026-02-01T00:00:00.000Z",
      completedAt: "2026-01-01T00:00:00.000Z",
    },
    { status: "inProgress", completedAt: "2026-01-01T00:00:00.000Z" },
  ])(
    "отклоняет несогласованные даты создания попытки и сохраняет запись: %j",
    async (payload) => {
      const { app } = getTestApplication()
      const { entry, headers } = await createEntry()
      const before = await readEntry(entry.id)
      const response = await app.inject({
        method: "POST",
        url: `/userItems/${entry.id}/attempts`,
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
      const prepared = await app.inject({
        method: "PATCH",
        url: `/userItems/${entry.id}/attempts/${entry.attempts[0]?.id}`,
        headers,
        payload: { completedAt: "2026-01-01T00:00:00.000Z" },
      })
      expect(prepared.statusCode).toBe(200)
      const before = await readEntry(entry.id)
      const response = await app.inject({
        method: "PATCH",
        url: `/userItems/${entry.id}/attempts/${entry.attempts[0]?.id}`,
        headers,
        payload,
      })

      expect(response.statusCode).toBe(400)
      expect(await readEntry(entry.id)).toEqual(before)
    },
  )

  it("параллельные добавления текущих попыток сохраняют только одну", async () => {
    const { app } = getTestApplication()
    const { entry, headers } = await createEntry()
    synchronizeMutationReads(2)
    const responses = await Promise.all(
      ["inProgress", "onHold"].map((status) =>
        app.inject({
          method: "POST",
          url: `/userItems/${entry.id}/attempts`,
          headers,
          payload: { status },
        }),
      ),
    )

    expect(responses.map((response) => response.statusCode).sort()).toEqual([
      201, 409,
    ])
    const record = await readEntry(entry.id)
    expect(record.attempts).toHaveLength(1)
    expect(record.status).toBe(record.attempts[0]?.status)
  })

  it("параллельные исторические попытки и изменения полей не теряются", async () => {
    const { app } = getTestApplication()
    const { entry, headers } = await createEntry()
    synchronizeMutationReads(4)
    const responses = await Promise.all([
      app.inject({
        method: "POST",
        url: `/userItems/${entry.id}/attempts`,
        headers,
        payload: { status: "completed", progress: 90 },
      }),
      app.inject({
        method: "POST",
        url: `/userItems/${entry.id}/attempts`,
        headers,
        payload: { status: "dropped", progress: 30 },
      }),
      app.inject({
        method: "PATCH",
        url: `/userItems/${entry.id}`,
        headers,
        payload: { rating: 8 },
      }),
      app.inject({
        method: "PATCH",
        url: `/userItems/${entry.id}`,
        headers,
        payload: { isFavorite: true },
      }),
    ])

    expect(responses.map((response) => response.statusCode).sort()).toEqual([
      200, 200, 201, 201,
    ])
    const record = await readEntry(entry.id)
    expect(record).toMatchObject({
      status: "planned",
      rating: 8,
      isFavorite: true,
    })
    expect(record.attempts).toHaveLength(2)
    expect(record.attempts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ status: "completed", progress: 90 }),
        expect.objectContaining({ status: "dropped", progress: 30 }),
      ]),
    )
  })

  it.each([
    { method: "DELETE", path: "" },
    { method: "PATCH", path: "", payload: { status: "completed" } },
    { method: "PATCH", path: "", payload: { isFavorite: true } },
    { method: "PATCH", path: "", payload: { rating: 9 } },
    { method: "PATCH", path: "", payload: { note: "Заметка" } },
    { method: "POST", path: "/attempts", payload: { status: "completed" } },
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
})
