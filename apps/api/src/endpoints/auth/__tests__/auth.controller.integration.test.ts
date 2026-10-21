import { createHash } from "node:crypto"

import { describe, expect, it } from "@jest/globals"

import type { User } from "@entities/user/schemas/user.schema"
import type { Session } from "@entities/session/schemas/session.schema"
import { SecurityJwtService } from "@infrastructure/security/services/jwt.service"
import { JWT_ACCESS_EXPIRATION } from "@infrastructure/security/static/JWT_ACCESS_EXPIRATION"
import { JWT_REFRESH_EXPIRATION } from "@infrastructure/security/static/JWT_REFRESH_EXPIRATION"
import { getTestApplication } from "@test/setup/setupIntegration"

import { createAccount } from "../../account/__tests__/functions/createAccount"
import type { RegisterResponseDto } from "../dto/response/register.response"

describe("AuthController HTTP", () => {
  const expectAuthCookies = (
    cookies: Array<{ name: string; value: string }>,
  ) => {
    expect(cookies).toHaveLength(2)
    for (const [name, maxAge] of [
      ["__Host-accessToken", JWT_ACCESS_EXPIRATION],
      ["__Host-refreshToken", JWT_REFRESH_EXPIRATION],
    ] as const) {
      expect(cookies).toContainEqual(
        expect.objectContaining({
          name,
          value: expect.any(String),
          path: "/",
          httpOnly: true,
          secure: true,
          sameSite: "Strict",
          maxAge,
        }),
      )
    }
  }

  it("регистрирует пользователя без тела, сохраняет хеши и выдаёт рабочую сессию", async () => {
    const { app, connection } = getTestApplication()
    const startedAt = Date.now()
    const response = await app.inject({
      method: "POST",
      url: "/auth/register",
      headers: {
        origin: "http://localhost",
        "user-agent": "registration-browser",
      },
    })

    expect(response.statusCode).toBe(201)
    expect(response.headers["cache-control"]).toBe("no-store")
    const result = response.json<RegisterResponseDto>()
    expect(result).toEqual({
      username: expect.any(String),
      accessCode: expect.stringMatching(/^[A-Za-z0-9_-]{32}$/),
    })
    expectAuthCookies(response.cookies)
    const user = await connection
      .collection<User>("User")
      .findOne({ username: result.username })
    expect(user).toMatchObject({
      passwordHash: null,
      accessCodeHash: createHash("sha256")
        .update(result.accessCode)
        .digest("hex"),
    })
    const cookieHeader = response.cookies
      .map(({ name, value }) => `${name}=${value}`)
      .join("; ")
    const accessToken =
      response.cookies.find(({ name }) => name === "__Host-accessToken")
        ?.value ?? ""
    const refreshToken =
      response.cookies.find(({ name }) => name === "__Host-refreshToken")
        ?.value ?? ""
    const jwt = app.get(SecurityJwtService)
    const access = await jwt.verifyAccessToken(accessToken)
    const refresh = await jwt.verifyRefreshToken(refreshToken)
    expect(access.sub).toBe(user?._id.toHexString())
    expect(refresh).toMatchObject({
      sub: access.sub,
      sessionId: access.sessionId,
    })
    const session = await connection
      .collection<Session>("Session")
      .findOne({ user: user?._id })
    expect(session?._id.toHexString()).toBe(access.sessionId)
    expect(session).toMatchObject({
      userAgent: "registration-browser",
      refreshTokenHash: createHash("sha256").update(refreshToken).digest("hex"),
    })
    expect(session?.expiresAt.getTime()).toBeGreaterThanOrEqual(
      startedAt + JWT_REFRESH_EXPIRATION * 1000,
    )
    expect(session?.expiresAt.getTime()).toBeLessThanOrEqual(
      Date.now() + JWT_REFRESH_EXPIRATION * 1000,
    )
    expect(
      (
        await app.inject({
          method: "GET",
          url: "/account/whoami",
          headers: { cookie: cookieHeader },
        })
      ).statusCode,
    ).toBe(200)
  })

  it.each(["password", "anonymous"] as const)(
    "создаёт новую сессию при входе в аккаунт %s и сохраняет прежнюю",
    async (kind) => {
      const { app, connection } = getTestApplication()
      const account = await createAccount(kind)
      const response = await app.inject({
        method: "POST",
        url: kind === "password" ? "/auth/login" : "/auth/login/code",
        headers: { origin: "http://localhost", "user-agent": "login-browser" },
        payload:
          kind === "password"
            ? {
                username: `  ${account.user.username.toUpperCase()}  `,
                password: account.password,
              }
            : { accessCode: account.accessCode },
      })

      expect(response.statusCode).toBe(204)
      expect(response.body).toBe("")
      expect(response.headers["cache-control"]).toBe("no-store")
      expectAuthCookies(response.cookies)
      const sessions = await connection
        .collection<Session>("Session")
        .find({ user: account.user._id })
        .toArray()
      expect(sessions).toHaveLength(2)
      expect(sessions).toContainEqual(
        expect.objectContaining({ _id: account.session._id }),
      )
      const accessToken =
        response.cookies.find(({ name }) => name === "__Host-accessToken")
          ?.value ?? ""
      const refreshToken =
        response.cookies.find(({ name }) => name === "__Host-refreshToken")
          ?.value ?? ""
      const access = await app
        .get(SecurityJwtService)
        .verifyAccessToken(accessToken)
      expect(access.sub).toBe(account.user._id.toHexString())
      const created = sessions.find(
        (session) => session._id.toHexString() === access.sessionId,
      )
      expect(created).toMatchObject({
        userAgent: "login-browser",
        refreshTokenHash: createHash("sha256")
          .update(refreshToken)
          .digest("hex"),
      })
      expect(created?._id.equals(account.session._id)).toBe(false)
      const whoami = await app.inject({
        method: "GET",
        url: "/account/whoami",
        headers: { cookie: `__Host-accessToken=${accessToken}` },
      })
      expect(whoami.statusCode).toBe(200)
    },
  )

  it.each(["unknown-user", "wrong-password", "anonymous", "password-spaces"])(
    "отклоняет вход по паролю: %s, сохраняя сессии и cookies",
    async (scenario) => {
      const { app, connection } = getTestApplication()
      const account = await createAccount(
        scenario === "anonymous" ? "anonymous" : "password",
      )
      const response = await app.inject({
        method: "POST",
        url: "/auth/login",
        headers: account.headers,
        payload: {
          username:
            scenario === "unknown-user"
              ? "unknownuser123"
              : account.user.username,
          password:
            scenario === "wrong-password"
              ? "Wrong-password-123"
              : scenario === "password-spaces"
                ? ` ${account.password} `
                : account.password,
        },
      })

      expect(response.statusCode).toBe(401)
      expect(response.cookies).toEqual([])
      expect(
        await connection.collection<Session>("Session").countDocuments({}),
      ).toBe(1)
    },
  )

  it.each(["wrong-code", "password-account"])(
    "отклоняет вход по коду: %s без создания сессии",
    async (scenario) => {
      const { app, connection } = getTestApplication()
      const account = await createAccount(
        scenario === "password-account" ? "password" : "anonymous",
      )
      const response = await app.inject({
        method: "POST",
        url: "/auth/login/code",
        headers: account.headers,
        payload: {
          accessCode:
            scenario === "wrong-code" ? "A".repeat(32) : account.accessCode,
        },
      })

      expect(response.statusCode).toBe(401)
      expect(response.cookies).toEqual([])
      expect(
        await connection.collection<Session>("Session").countDocuments({}),
      ).toBe(1)
    },
  )

  it.each([
    { url: "/auth/login", payload: {} },
    {
      url: "/auth/login",
      payload: { username: "bad name!", password: "Password-123" },
    },
    {
      url: "/auth/login",
      payload: { username: "username", password: "short" },
    },
    {
      url: "/auth/login",
      payload: { username: "username", password: "я".repeat(37) },
    },
    {
      url: "/auth/login",
      payload: { username: 123, password: "Password-123" },
    },
    {
      url: "/auth/login",
      payload: {
        username: "username",
        password: "Password-123",
        role: "admin",
      },
    },
    { url: "/auth/login/code", payload: {} },
    { url: "/auth/login/code", payload: { accessCode: 123 } },
    { url: "/auth/login/code", payload: { accessCode: "A".repeat(31) } },
    { url: "/auth/login/code", payload: { accessCode: "A".repeat(33) } },
    { url: "/auth/login/code", payload: { accessCode: "!".repeat(32) } },
    {
      url: "/auth/login/code",
      payload: { accessCode: "A".repeat(32), username: "username" },
    },
  ])(
    "возвращает 400 для некорректного тела $url: $payload",
    async ({ url, payload }) => {
      const { app, connection } = getTestApplication()
      const response = await app.inject({
        method: "POST",
        url,
        headers: { origin: "http://localhost" },
        payload,
      })

      expect(response.statusCode).toBe(400)
      expect(response.cookies).toEqual([])
      expect(
        await connection.collection<Session>("Session").countDocuments({}),
      ).toBe(0)
    },
  )

  it("удаляет только текущую сессию, очищает cookies и запрещает повторное использование токенов", async () => {
    const { app, connection } = getTestApplication()
    const account = await createAccount()
    const login = await app.inject({
      method: "POST",
      url: "/auth/login/code",
      headers: account.headers,
      payload: { accessCode: account.accessCode },
    })
    expect(login.statusCode).toBe(204)
    const response = await app.inject({
      method: "POST",
      url: "/auth/logout",
      headers: account.headers,
    })

    expect(response.statusCode).toBe(204)
    expect(response.body).toBe("")
    expect(response.headers["cache-control"]).toBe("no-store")
    expect(response.cookies).toHaveLength(2)
    for (const name of ["__Host-accessToken", "__Host-refreshToken"]) {
      expect(response.cookies).toContainEqual(
        expect.objectContaining({
          name,
          value: "",
          path: "/",
          httpOnly: true,
          secure: true,
          sameSite: "Strict",
        }),
      )
      const cookie = response.cookies.find((entry) => entry.name === name)
      expect(cookie?.expires?.getTime()).toBeLessThanOrEqual(Date.now())
    }
    expect(
      await connection
        .collection<Session>("Session")
        .findOne({ _id: account.session._id }),
    ).toBeNull()
    expect(
      await connection
        .collection<Session>("Session")
        .countDocuments({ user: account.user._id }),
    ).toBe(1)
    for (const [method, url] of [
      ["POST", "/auth/logout"],
      ["GET", "/account/whoami"],
      ["PATCH", "/auth/session/refresh"],
    ] as const) {
      const denied = await app.inject({ method, url, headers: account.headers })
      expect(denied.statusCode).toBe(401)
      expect(denied.cookies).toEqual([])
    }
    expect(
      (
        await app.inject({
          method: "GET",
          url: "/account/whoami",
          headers: {
            cookie: login.cookies
              .map(({ name, value }) => `${name}=${value}`)
              .join("; "),
          },
        })
      ).statusCode,
    ).toBe(200)
  })

  it.each([
    undefined,
    "__Host-accessToken=invalid",
    "__Host-refreshToken=invalid",
  ])(
    "возвращает 401 при выходе без действующего access cookie: %s",
    async (cookie) => {
      const response = await getTestApplication().app.inject({
        method: "POST",
        url: "/auth/logout",
        headers: {
          origin: "http://localhost",
          ...(cookie === undefined ? {} : { cookie }),
        },
      })
      expect(response.statusCode).toBe(401)
      expect(response.cookies).toEqual([])
    },
  )

  it.each(["expired", "missing", "another-user"])(
    "отклоняет выход для недействующей сессии: %s",
    async (scenario) => {
      const { app, connection } = getTestApplication()
      const account = await createAccount()
      const sessions = connection.collection<Session>("Session")
      if (scenario === "missing") {
        await sessions.deleteOne({ _id: account.session._id })
      } else {
        const other =
          scenario === "another-user" ? await createAccount() : undefined
        await sessions.updateOne(
          { _id: account.session._id },
          {
            $set:
              other === undefined
                ? { expiresAt: new Date(Date.now() - 1000) }
                : { user: other.user._id },
          },
        )
      }
      const before = await sessions.find({}).toArray()
      const response = await app.inject({
        method: "POST",
        url: "/auth/logout",
        headers: account.headers,
      })

      expect(response.statusCode).toBe(401)
      expect(response.cookies).toEqual([])
      expect(await sessions.find({}).toArray()).toEqual(before)
    },
  )

  it.each([
    "/auth/register",
    "/auth/login",
    "/auth/login/code",
    "/auth/logout",
  ])("отклоняет посторонний Origin для %s без изменения базы", async (url) => {
    const { app, connection } = getTestApplication()
    const response = await app.inject({
      method: "POST",
      url,
      headers: { origin: "https://untrusted.example" },
    })
    expect(response.statusCode).toBe(403)
    expect(response.cookies).toEqual([])
    expect(await connection.collection<User>("User").countDocuments({})).toBe(0)
    expect(
      await connection.collection<Session>("Session").countDocuments({}),
    ).toBe(0)
  })

  it.each([
    { url: "/auth/register", limit: 2, status: 201, payload: undefined },
    {
      url: "/auth/login",
      limit: 5,
      status: 401,
      payload: { username: "unknownuser", password: "Password-123" },
    },
    {
      url: "/auth/login/code",
      limit: 5,
      status: 401,
      payload: { accessCode: "A".repeat(32) },
    },
  ])(
    "ограничивает $url после $limit запросов",
    async ({ url, limit, status, payload }) => {
      const { app, connection } = getTestApplication()
      for (let index = 0; index < limit; index += 1) {
        expect(
          (
            await app.inject({
              method: "POST",
              url,
              headers: { origin: "http://localhost" },
              payload,
            })
          ).statusCode,
        ).toBe(status)
      }
      const before = await connection
        .collection<Session>("Session")
        .countDocuments({})
      const response = await app.inject({
        method: "POST",
        url,
        headers: { origin: "http://localhost" },
        payload,
      })
      expect(response.statusCode).toBe(429)
      expect(response.cookies).toEqual([])
      expect(
        await connection.collection<Session>("Session").countDocuments({}),
      ).toBe(before)
    },
  )
})
