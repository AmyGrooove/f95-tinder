import { describe, expect, it } from "@jest/globals"
import { Types } from "mongoose"

import type { UserSession } from "@entities/userSession/schemas/userSession.schema"
import type { UserCollection } from "@entities/userCollection/schemas/userCollection.schema"
import { createAccount } from "@endpoints/account/__tests__/functions/createAccount"
import { getTestApplication } from "@app/__tests__/setup/setupIntegration"

import { createCollection } from "@endpoints/collection/__tests__/functions/createCollection"

describe("CollectionUserController", () => {
  it("блокирует изменение личной реакции с постороннего Origin", async () => {
    const { app } = getTestApplication()
    const { owner, collection } = await createCollection()
    const url = "/collections/" + collection.id + "/user"
    const response = await app.inject({
      method: "PATCH",
      url,
      headers: { ...owner.headers, origin: "https://foreign.example" },
      payload: { isFavorite: true },
    })
    expect(response.statusCode).toBe(403)
    const reaction = await app.inject({
      method: "GET",
      url,
      headers: owner.headers,
    })
    expect(reaction.statusCode).toBe(200)
    expect(reaction.json()).toEqual({
      isFavorite: false,
      rating: null,
      isHidden: false,
    })
  })

  it("сохраняет параллельные первые реакции в одной записи без потери независимых полей", async () => {
    const { app, connection } = getTestApplication()
    const { collection } = await createCollection()
    const { user, headers } = await createAccount()
    const responses = await Promise.all(
      [
        { path: "favorite", payload: { isFavorite: true } },
        { path: "hidden", payload: { isHidden: true } },
        { path: "rating", payload: { rating: 8 } },
      ].map(async ({ payload }) =>
        app.inject({
          method: "PATCH",
          url: `/collections/${collection.id}/user`,
          headers,
          payload,
        }),
      ),
    )
    expect(responses.map((response) => response.statusCode)).toEqual([
      204, 204, 204,
    ])
    expect(responses.map((response) => response.body)).toEqual(["", "", ""])
    const records = await connection
      .collection("UserCollection")
      .find({ user: user._id, collectionId: new Types.ObjectId(collection.id) })
      .toArray()
    expect(records).toHaveLength(1)
    expect(records[0]).toMatchObject({
      isFavorite: true,
      isHidden: true,
      rating: 8,
    })
    const read = await app.inject({
      method: "GET",
      url: `/collections/${collection.id}/user`,
      headers,
    })
    expect(read.statusCode).toBe(200)
    expect(read.json()).toEqual({ isFavorite: true, isHidden: true, rating: 8 })
  })

  it("принимает несколько полей в одном запросе и отклоняет прежние маршруты", async () => {
    const { app } = getTestApplication()
    const { collection } = await createCollection()
    const { headers } = await createAccount()
    const base = "/collections/" + collection.id
    const response = await app.inject({
      method: "PATCH",
      url: base + "/user",
      headers,
      payload: {
        isFavorite: true,
        isHidden: true,
        rating: 8,
      },
    })
    expect(response.statusCode).toBe(204)
    expect(response.body).toBe("")
    expect(
      (
        await app.inject({ method: "GET", url: base + "/user", headers })
      ).json(),
    ).toEqual({
      isFavorite: true,
      isHidden: true,
      rating: 8,
    })
    for (const path of ["favorite", "hidden", "rating"]) {
      expect(
        (
          await app.inject({
            method: "PATCH",
            url: base + "/" + path,
            headers,
            payload: {},
          })
        ).statusCode,
      ).toBe(404)
    }
  })

  it("возвращает реакцию по умолчанию без создания записи", async () => {
    const { app, connection } = getTestApplication()
    const { collection, owner } = await createCollection()
    const response = await app.inject({
      method: "GET",
      url: `/collections/${collection.id}/user`,
      headers: owner.headers,
    })
    expect(response.statusCode).toBe(200)
    expect(response.headers["cache-control"]).toBe("no-store")
    expect(response.json()).toEqual({
      isFavorite: false,
      rating: null,
      isHidden: false,
    })
    expect(await connection.collection("UserCollection").countDocuments()).toBe(
      0,
    )
  })

  it("сохраняет независимые реакции, снимает их и изолирует данные пользователей", async () => {
    const { app, connection } = getTestApplication()
    const { collection, owner } = await createCollection()
    const { user, headers } = await createAccount()
    const base = `/collections/${collection.id}`
    const changes = [
      {
        path: "favorite",
        payload: { isFavorite: true },
        expected: { isFavorite: true, rating: null, isHidden: false },
      },
      {
        path: "rating",
        payload: { rating: 10 },
        expected: { isFavorite: true, rating: 10, isHidden: false },
      },
      {
        path: "hidden",
        payload: { isHidden: true },
        expected: { isFavorite: true, rating: 10, isHidden: true },
      },
      {
        path: "rating",
        payload: { rating: 1 },
        expected: { isFavorite: true, rating: 1, isHidden: true },
      },
      {
        path: "rating",
        payload: { rating: null },
        expected: { isFavorite: true, rating: null, isHidden: true },
      },
      {
        path: "favorite",
        payload: { isFavorite: false },
        expected: { isFavorite: false, rating: null, isHidden: true },
      },
      {
        path: "hidden",
        payload: { isHidden: false },
        expected: { isFavorite: false, rating: null, isHidden: false },
      },
    ]
    for (const { payload, expected } of changes) {
      const response = await app.inject({
        method: "PATCH",
        url: `${base}/user`,
        headers,
        payload,
      })
      expect(response.statusCode).toBe(204)
      expect(response.headers["cache-control"]).toBe("no-store")
      expect(response.body).toBe("")
      expect(
        await connection.collection<UserCollection>("UserCollection").findOne({
          user: user._id,
          collectionId: new Types.ObjectId(collection.id),
        }),
      ).toMatchObject(expected)
      const read = await app.inject({
        method: "GET",
        url: `${base}/user`,
        headers,
      })
      expect(read.statusCode).toBe(200)
      expect(read.json()).toEqual(expected)
    }
    expect(await connection.collection("UserCollection").countDocuments()).toBe(
      1,
    )
    const ownerRead = await app.inject({
      method: "GET",
      url: `${base}/user`,
      headers: owner.headers,
    })
    expect(ownerRead.json()).toEqual({
      isFavorite: false,
      rating: null,
      isHidden: false,
    })
    expect(await connection.collection("UserItem").countDocuments()).toBe(0)
    expect(await connection.collection("ItemCollection").countDocuments()).toBe(
      2,
    )
  })

  it("повторная установка реакции не создаёт дубль и не раскрывает внутренние поля", async () => {
    const { app, connection } = getTestApplication()
    const { collection, owner } = await createCollection()
    for (const isFavorite of [true, true]) {
      const response = await app.inject({
        method: "PATCH",
        url: `/collections/${collection.id}/user`,
        headers: owner.headers,
        payload: { isFavorite },
      })
      expect(response.statusCode).toBe(204)
      expect(response.body).toBe("")
      expect(
        await connection.collection("UserCollection").countDocuments(),
      ).toBe(1)
    }
  })

  it("запрещает автору оценивать свою подборку, разрешая сброс оценки и другие реакции", async () => {
    const { app, connection } = getTestApplication()
    const { collection, owner } = await createCollection()
    const url = `/collections/${collection.id}/user`
    expect(
      (
        await app.inject({
          method: "PATCH",
          url,
          headers: owner.headers,
          payload: { rating: 5 },
        })
      ).statusCode,
    ).toBe(409)
    expect(await connection.collection("UserCollection").countDocuments()).toBe(
      0,
    )
    const clear = await app.inject({
      method: "PATCH",
      url,
      headers: owner.headers,
      payload: { rating: null },
    })
    expect(clear.statusCode).toBe(204)
    expect(clear.body).toBe("")
  })

  it.each([
    { path: "favorite", payload: {} },
    { path: "favorite", payload: { isFavorite: "true" } },
    { path: "favorite", payload: { isFavorite: null } },
    { path: "favorite", payload: { isFavorite: true, unexpected: 4 } },
    { path: "hidden", payload: {} },
    { path: "hidden", payload: { isHidden: 1 } },
    { path: "hidden", payload: { isHidden: null } },
    { path: "rating", payload: {} },
    { path: "rating", payload: { rating: 0 } },
    { path: "rating", payload: { rating: 11 } },
    { path: "rating", payload: { rating: 1.5 } },
    { path: "rating", payload: { rating: "5" } },
  ])("отклоняет некорректное тело $path: $payload", async ({ payload }) => {
    const { app, connection } = getTestApplication()
    const { collection, owner } = await createCollection()
    const response = await app.inject({
      method: "PATCH",
      url: `/collections/${collection.id}/user`,
      headers: owner.headers,
      payload,
    })
    expect(response.statusCode).toBe(400)
    expect(await connection.collection("UserCollection").countDocuments()).toBe(
      0,
    )
  })

  it.each([
    { path: "user", method: "GET" as const, payload: undefined },
    {
      path: "favorite",
      method: "PATCH" as const,
      payload: { isFavorite: true },
    },
    { path: "rating", method: "PATCH" as const, payload: { rating: null } },
    { path: "hidden", method: "PATCH" as const, payload: { isHidden: true } },
  ])(
    "проверяет cookie, сессию, id и существование подборки для $path",
    async ({ method, payload }) => {
      const { app, connection } = getTestApplication()
      const { collection, owner } = await createCollection()
      const url = `/collections/${collection.id}/user`
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
            headers: {
              origin: "http://localhost",
              cookie: "__Host-accessToken=invalid",
            },
            payload,
          })
        ).statusCode,
      ).toBe(401)
      expect(
        (
          await app.inject({
            method,
            url: `/collections/invalid/user`,
            headers: owner.headers,
            payload,
          })
        ).statusCode,
      ).toBe(400)
      expect(
        (
          await app.inject({
            method,
            url: `/collections/${new Types.ObjectId().toHexString()}/user`,
            headers: owner.headers,
            payload,
          })
        ).statusCode,
      ).toBe(404)
      if (method === "PATCH") {
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
      }
      await connection
        .collection("Collection")
        .updateOne(
          { _id: new Types.ObjectId(collection.id) },
          { $set: { deletedAt: new Date() } },
        )
      expect(
        (await app.inject({ method, url, headers: owner.headers, payload }))
          .statusCode,
      ).toBe(404)
      await connection
        .collection<UserSession>("UserSession")
        .updateOne(
          { _id: owner.session._id },
          { $set: { expiresAt: new Date(Date.now() - 1000) } },
        )
      expect(
        (await app.inject({ method, url, headers: owner.headers, payload }))
          .statusCode,
      ).toBe(401)
      expect(
        await connection.collection("UserCollection").countDocuments(),
      ).toBe(0)
    },
  )
})
