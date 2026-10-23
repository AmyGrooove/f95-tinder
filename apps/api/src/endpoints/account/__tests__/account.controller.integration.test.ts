import { describe, expect, it } from "@jest/globals"

import type { User } from "@entities/user/schemas/user.schema"
import type { Session } from "@entities/session/schemas/session.schema"
import { getTestApplication } from "@test/setup/setupIntegration"

import { createAccount } from "./functions/createAccount"

describe("AccountController HTTP", () => {
  it("возвращает профиль без хешей и запрещает кеширование", async () => {
    const { app } = getTestApplication()
    const { user, headers } = await createAccount()
    const response = await app.inject({
      method: "GET",
      url: "/account",
      headers,
    })

    expect(response.statusCode).toBe(200)
    expect(response.headers["cache-control"]).toBe("no-store")
    expect(response.json()).toEqual({
      id: user._id.toHexString(),
      username: user.username,
      displayName: user.displayName,
      avatarUrl: null,
      role: user.role,
      email: null,
      isPasswordSet: false,
      isAccessCodeSet: true,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    })
  })

  it("возвращает пользователя и действующую сессию через whoami", async () => {
    const { app } = getTestApplication()
    const { user, session, headers } = await createAccount()
    const response = await app.inject({
      method: "GET",
      url: "/account/whoami",
      headers,
    })

    expect(response.statusCode).toBe(200)
    expect(response.headers["cache-control"]).toBe("no-store")
    expect(response.json()).toEqual({
      user: {
        id: user._id.toHexString(),
        username: user.username,
        displayName: user.displayName,
        avatarUrl: null,
        role: user.role,
      },
      session: {
        id: session._id.toHexString(),
        expiresAt: session.expiresAt.toISOString(),
      },
    })
  })

  it.each(["/account", "/account/whoami"])(
    "возвращает 401 без cookies для %s",
    async (url) => {
      const response = await getTestApplication().app.inject({
        method: "GET",
        url,
      })

      expect(response.statusCode).toBe(401)
      expect(response.json()).toMatchObject({
        error: { code: "UNAUTHORIZED", requestId: expect.any(String) },
      })
    },
  )

  it.each(["/account", "/account/whoami"])(
    "отклоняет поддельный токен для %s",
    async (url) => {
      const response = await getTestApplication().app.inject({
        method: "GET",
        url,
        headers: { cookie: "__Host-accessToken=invalid-token" },
      })

      expect(response.statusCode).toBe(401)
    },
  )

  it.each(["/account", "/account/whoami"])(
    "отклоняет истёкшую сессию для %s",
    async (url) => {
      const { app, connection } = getTestApplication()
      const { session, headers } = await createAccount()
      await connection
        .collection<Session>("Session")
        .updateOne(
          { _id: session._id },
          { $set: { expiresAt: new Date(Date.now() - 1000) } },
        )

      const response = await app.inject({ method: "GET", url, headers })

      expect(response.statusCode).toBe(401)
    },
  )

  it("обновляет отображаемое имя в MongoDB, удаляя пробелы по краям", async () => {
    const { app, connection } = getTestApplication()
    const { user, headers } = await createAccount()
    const response = await app.inject({
      method: "PATCH",
      url: "/account/displayName",
      headers,
      payload: { displayName: "  Новое имя  " },
    })

    expect(response.statusCode).toBe(204)
    expect(response.body).toBe("")
    expect(response.headers["cache-control"]).toBe("no-store")
    expect(
      await connection.collection<User>("User").findOne({ _id: user._id }),
    ).toMatchObject({ displayName: "Новое имя" })
  })

  it("обновляет имя пользователя в MongoDB, удаляя пробелы и приводя к нижнему регистру", async () => {
    const { app, connection } = getTestApplication()
    const { user, headers } = await createAccount()
    const response = await app.inject({
      method: "PATCH",
      url: "/account/username",
      headers,
      payload: { username: "  NewUsername123  " },
    })

    expect(response.statusCode).toBe(204)
    expect(response.body).toBe("")
    expect(response.headers["cache-control"]).toBe("no-store")
    expect(
      await connection.collection<User>("User").findOne({ _id: user._id }),
    ).toMatchObject({ username: "newusername123" })
  })

  it.each([
    { field: "username", value: "a".repeat(32) },
    { field: "username", value: `  ${"A".repeat(32)}  ` },
    { field: "displayName", value: "Я".repeat(40) },
    { field: "displayName", value: `  ${"Я".repeat(40)}  ` },
    { field: "displayName", value: "😀".repeat(40) },
  ])(
    "сохраняет $field на границе длины после нормализации: $value",
    async ({ field, value }) => {
      const { app, connection } = getTestApplication()
      const { user, headers } = await createAccount()
      const response = await app.inject({
        method: "PATCH",
        url: `/account/${field}`,
        headers,
        payload: { [field]: value },
      })

      expect(response.statusCode).toBe(204)
      expect(response.body).toBe("")
      expect(
        await connection.collection<User>("User").findOne({ _id: user._id }),
      ).toMatchObject({
        [field]:
          field === "username" ? value.trim().toLowerCase() : value.trim(),
      })
    },
  )

  it("возвращает 409 при занятом имени и сохраняет прежнее имя", async () => {
    const { app, connection } = getTestApplication()
    const first = await createAccount()
    const second = await createAccount()
    const response = await app.inject({
      method: "PATCH",
      url: "/account/username",
      headers: first.headers,
      payload: { username: second.user.username },
    })

    expect(response.statusCode).toBe(409)
    expect(
      await connection
        .collection<User>("User")
        .findOne({ _id: first.user._id }),
    ).toMatchObject({ username: first.user.username })
  })

  it.each([
    { url: "/account/displayName", payload: { displayName: "   " } },
    { url: "/account/username", payload: { username: "bad name!" } },
    { url: "/account/username", payload: { username: "a".repeat(33) } },
    { url: "/account/displayName", payload: { displayName: "Я".repeat(41) } },
    { url: "/account/displayName", payload: { displayName: "😀".repeat(41) } },
    {
      url: "/account/displayName",
      payload: { displayName: "Имя", role: "admin" },
    },
  ])("возвращает 400 для некорректного тела $url", async ({ url, payload }) => {
    const { app, connection } = getTestApplication()
    const { user, headers } = await createAccount()
    const response = await app.inject({
      method: "PATCH",
      url,
      headers,
      payload,
    })

    expect(response.statusCode).toBe(400)
    expect(
      await connection.collection<User>("User").findOne({ _id: user._id }),
    ).toMatchObject({
      username: user.username,
      displayName: user.displayName,
      role: user.role,
    })
  })

  it.each([
    { url: "/account/displayName", payload: { displayName: "Имя" } },
    { url: "/account/username", payload: { username: "username123" } },
  ])("возвращает 401 без авторизации для $url", async ({ url, payload }) => {
    const response = await getTestApplication().app.inject({
      method: "PATCH",
      url,
      headers: { origin: "http://localhost" },
      payload,
    })

    expect(response.statusCode).toBe(401)
  })

  it("отклоняет изменение профиля с постороннего Origin без изменения MongoDB", async () => {
    const { app, connection } = getTestApplication()
    const { user, headers } = await createAccount()
    const response = await app.inject({
      method: "PATCH",
      url: "/account/displayName",
      headers: { ...headers, origin: "https://untrusted.example" },
      payload: { displayName: "Чужое имя" },
    })

    expect(response.statusCode).toBe(403)
    expect(
      await connection.collection<User>("User").findOne({ _id: user._id }),
    ).toMatchObject({ displayName: user.displayName })
  })
})
