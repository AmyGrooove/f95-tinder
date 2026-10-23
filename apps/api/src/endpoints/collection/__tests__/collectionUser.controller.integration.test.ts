import { describe, expect, it } from "@jest/globals"
import { Types } from "mongoose"

import type { Session } from "@entities/session/schemas/session.schema"
import type { UserCollection } from "@entities/userCollection/schemas/userCollection.schema"
import { createAccount } from "@endpoints/account/__tests__/functions/createAccount"
import { getTestApplication } from "@test/setup/setupIntegration"

import { createCollection } from "./functions/createCollection"

describe("CollectionUserController HTTP", () => {
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
    for (const { path, payload, expected } of changes) {
      const response = await app.inject({
        method: "PATCH",
        url: `${base}/${path}`,
        headers,
        payload,
      })
      expect(response.statusCode).toBe(200)
      expect(response.headers["cache-control"]).toBe("no-store")
      expect(response.json()).toEqual(expected)
      expect(
        await connection.collection<UserCollection>("UserCollection").findOne({
          user: user._id,
          collection: new Types.ObjectId(collection.id),
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
    expect(await connection.collection("CollectionItem").countDocuments()).toBe(
      2,
    )
  })

  it("повторная установка реакции не создаёт дубль и не раскрывает внутренние поля", async () => {
    const { app, connection } = getTestApplication()
    const { collection, owner } = await createCollection()
    for (const isFavorite of [true, true]) {
      const response = await app.inject({
        method: "PATCH",
        url: `/collections/${collection.id}/favorite`,
        headers: owner.headers,
        payload: { isFavorite },
      })
      expect(response.statusCode).toBe(200)
      expect(response.json()).toEqual({
        isFavorite: true,
        rating: null,
        isHidden: false,
      })
      expect(
        await connection.collection("UserCollection").countDocuments(),
      ).toBe(1)
    }
  })

  it("запрещает автору оценивать свою подборку, разрешая сброс оценки и другие реакции", async () => {
    const { app, connection } = getTestApplication()
    const { collection, owner } = await createCollection()
    const url = `/collections/${collection.id}/rating`
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
    expect(clear.statusCode).toBe(200)
    expect(clear.json()).toEqual({
      isFavorite: false,
      rating: null,
      isHidden: false,
    })
  })

  it.each([
    { path: "favorite", payload: {} },
    { path: "favorite", payload: { isFavorite: "true" } },
    { path: "favorite", payload: { isFavorite: null } },
    { path: "favorite", payload: { isFavorite: true, rating: 4 } },
    { path: "hidden", payload: {} },
    { path: "hidden", payload: { isHidden: 1 } },
    { path: "hidden", payload: { isHidden: null } },
    { path: "rating", payload: {} },
    { path: "rating", payload: { rating: 0 } },
    { path: "rating", payload: { rating: 11 } },
    { path: "rating", payload: { rating: 1.5 } },
    { path: "rating", payload: { rating: "5" } },
  ])(
    "отклоняет некорректное тело $path: $payload",
    async ({ path, payload }) => {
      const { app, connection } = getTestApplication()
      const { collection, owner } = await createCollection()
      const response = await app.inject({
        method: "PATCH",
        url: `/collections/${collection.id}/${path}`,
        headers: owner.headers,
        payload,
      })
      expect(response.statusCode).toBe(400)
      expect(
        await connection.collection("UserCollection").countDocuments(),
      ).toBe(0)
    },
  )

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
    async ({ path, method, payload }) => {
      const { app, connection } = getTestApplication()
      const { collection, owner } = await createCollection()
      const url = `/collections/${collection.id}/${path}`
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
            url: `/collections/invalid/${path}`,
            headers: owner.headers,
            payload,
          })
        ).statusCode,
      ).toBe(400)
      expect(
        (
          await app.inject({
            method,
            url: `/collections/${new Types.ObjectId().toHexString()}/${path}`,
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
        .collection<Session>("Session")
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
