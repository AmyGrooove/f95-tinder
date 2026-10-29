import { createHash, randomUUID } from "node:crypto"

import { describe, expect, it } from "@jest/globals"
import { Types } from "mongoose"

import type { UserSession } from "@entities/userSession/schemas/userSession.schema"
import type { User } from "@entities/user/schemas/user.schema"
import { EUserRole } from "@entities/user/schemas/EUserRole"
import { ECountry } from "@entities/shared/schemas/ECountry"
import { SecurityJwtService } from "@infrastructure/security/services/jwt.service"
import { JWT_ACCESS_EXPIRATION } from "@infrastructure/security/static/JWT_ACCESS_EXPIRATION"
import { JWT_REFRESH_EXPIRATION } from "@infrastructure/security/static/JWT_REFRESH_EXPIRATION"
import { getTestApplication } from "@test/setup/setupIntegration"

import { createAccount } from "../../account/__tests__/functions/createAccount"

describe("SessionController HTTP", () => {
  const addSession = async (
    session: UserSession,
    overrides: Partial<UserSession> = {},
  ) => {
    const created = {
      ...session,
      _id: new Types.ObjectId(),
      refreshTokenHash: randomUUID(),
      ...overrides,
    }
    await getTestApplication()
      .connection.collection<UserSession>("UserSession")
      .insertOne(created)

    return created
  }

  it("возвращает только активные собственные сессии с сортировкой, датами ISO и без секретов", async () => {
    const { app, connection } = getTestApplication()
    const account = await createAccount()
    const other = await createAccount()
    const createdAt = new Date("2026-01-01T00:00:00.000Z")
    const lastRefreshedAt = new Date("2026-01-02T00:00:00.000Z")
    await connection
      .collection<UserSession>("UserSession")
      .updateOne(
        { _id: account.session._id },
        { $set: { createdAt, userAgent: null } },
      )
    const first = await addSession(account.session, {
      _id: new Types.ObjectId("fffffffffffffffffffffff1"),
      createdAt,
      userAgent: "first-browser",
      lastRefreshedAt,
    })
    const second = await addSession(account.session, {
      _id: new Types.ObjectId("fffffffffffffffffffffff2"),
      createdAt,
      userAgent: "second-browser",
    })
    const newest = await addSession(account.session, {
      createdAt: new Date(createdAt.getTime() + 1000),
      userAgent: "newest-browser",
    })
    await addSession(account.session, {
      expiresAt: new Date(Date.now() - 1000),
    })
    const before = await connection
      .collection<UserSession>("UserSession")
      .find({})
      .toArray()
    const response = await app.inject({
      method: "GET",
      url: "/auth/session",
      headers: account.headers,
    })

    expect(response.statusCode).toBe(200)
    expect(response.headers["cache-control"]).toBe("no-store")
    expect(response.cookies).toEqual([])
    expect(response.json()).toEqual(
      [
        newest,
        second,
        first,
        { ...account.session, createdAt, userAgent: null },
      ].map((session) => ({
        id: session._id.toHexString(),
        userAgent: session.userAgent,
        country: session.country,
        createdAt: session.createdAt.toISOString(),
        expiresAt: session.expiresAt.toISOString(),
        lastRefreshedAt: session.lastRefreshedAt?.toISOString() ?? null,
        isCurrent: session._id.equals(account.session._id),
      })),
    )
    expect(
      await connection
        .collection<UserSession>("UserSession")
        .find({})
        .toArray(),
    ).toEqual(before)
    expect(response.body).not.toContain(other.session._id.toHexString())
  })

  it("удаляет остальные сессии, включая истёкшие, сохраняя текущую и чужие сессии", async () => {
    const { app, connection } = getTestApplication()
    const account = await createAccount()
    const other = await createAccount()
    await addSession(account.session)
    await addSession(account.session, {
      expiresAt: new Date(Date.now() - 1000),
    })
    const response = await app.inject({
      method: "DELETE",
      url: "/auth/session/others",
      headers: account.headers,
    })

    expect(response.statusCode).toBe(204)
    expect(response.body).toBe("")
    expect(response.headers["cache-control"]).toBe("no-store")
    expect(response.cookies).toEqual([])
    expect(
      await connection
        .collection<UserSession>("UserSession")
        .find({ user: account.user._id })
        .toArray(),
    ).toEqual([account.session])
    expect(
      await connection
        .collection<UserSession>("UserSession")
        .findOne({ _id: other.session._id }),
    ).toEqual(other.session)
    const repeated = await app.inject({
      method: "DELETE",
      url: "/auth/session/others",
      headers: account.headers,
    })
    expect(repeated.statusCode).toBe(204)
    expect(repeated.cookies).toEqual([])
    expect(
      (
        await app.inject({
          method: "GET",
          url: "/account/whoami",
          headers: account.headers,
        })
      ).statusCode,
    ).toBe(200)
  })

  it.each([true, false])(
    "удаляет выбранную собственную сессию и очищает cookies только для текущей: %s",
    async (isCurrent) => {
      const { app, connection } = getTestApplication()
      const account = await createAccount()
      const other = await createAccount()
      const extra = await addSession(account.session)
      const target = isCurrent ? account.session : extra
      const preserved = isCurrent ? extra : account.session
      const jwt = app.get(SecurityJwtService)
      const targetAccess = await jwt.signAccessToken({
        sub: account.user._id.toHexString(),
        sessionId: target._id.toHexString(),
        role: account.user.role,
      })
      const response = await app.inject({
        method: "DELETE",
        url: `/auth/session/${target._id.toHexString()}`,
        headers: account.headers,
      })

      expect(response.statusCode).toBe(204)
      expect(response.body).toBe("")
      expect(response.headers["cache-control"]).toBe("no-store")
      expect(response.cookies).toHaveLength(isCurrent ? 2 : 0)
      if (isCurrent) {
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
          expect(
            response.cookies
              .find((cookie) => cookie.name === name)
              ?.expires?.getTime(),
          ).toBeLessThanOrEqual(Date.now())
        }
      }
      expect(
        await connection
          .collection<UserSession>("UserSession")
          .findOne({ _id: target._id }),
      ).toBeNull()
      expect(
        await connection
          .collection<UserSession>("UserSession")
          .findOne({ _id: preserved._id }),
      ).toEqual(preserved)
      expect(
        await connection
          .collection<UserSession>("UserSession")
          .findOne({ _id: other.session._id }),
      ).toEqual(other.session)
      expect(
        (
          await app.inject({
            method: "GET",
            url: "/account/whoami",
            headers: { cookie: `__Host-accessToken=${targetAccess}` },
          })
        ).statusCode,
      ).toBe(401)
    },
  )

  it.each(["missing", "foreign", "expired"])(
    "возвращает 404 для недоступной целевой сессии: %s без изменений",
    async (scenario) => {
      const { app, connection } = getTestApplication()
      const account = await createAccount()
      const other = await createAccount()
      const target =
        scenario === "foreign"
          ? other.session._id
          : scenario === "expired"
            ? (
                await addSession(account.session, {
                  expiresAt: new Date(Date.now() - 1000),
                })
              )._id
            : new Types.ObjectId()
      const before = await connection
        .collection<UserSession>("UserSession")
        .find({})
        .toArray()
      const response = await app.inject({
        method: "DELETE",
        url: `/auth/session/${target.toHexString()}`,
        headers: account.headers,
      })

      expect(response.statusCode).toBe(404)
      expect(response.cookies).toEqual([])
      expect(
        await connection
          .collection<UserSession>("UserSession")
          .find({})
          .toArray(),
      ).toEqual(before)
    },
  )

  it.each(["invalid", "123", "g".repeat(24)])(
    "возвращает 400 для некорректного sessionId: %s",
    async (sessionId) => {
      const { app, connection } = getTestApplication()
      const account = await createAccount()
      const response = await app.inject({
        method: "DELETE",
        url: `/auth/session/${sessionId}`,
        headers: account.headers,
      })

      expect(response.statusCode).toBe(400)
      expect(response.cookies).toEqual([])
      expect(
        await connection
          .collection<UserSession>("UserSession")
          .findOne({ _id: account.session._id }),
      ).toEqual(account.session)
    },
  )

  it("обновляет токены без access cookie, сохраняет страну входа и использует актуальную роль пользователя", async () => {
    const { app, connection } = getTestApplication()
    const account = await createAccount()
    const extra = await addSession(account.session)
    const oldRefresh =
      account.headers.cookie.match(/__Host-refreshToken=([^;]+)/)?.[1] ?? ""
    const sessions = connection.collection<UserSession>("UserSession")
    await sessions.updateOne(
      { _id: account.session._id },
      {
        $set: {
          expiresAt: new Date(Date.now() + 60_000),
          country: ECountry.RUSSIA,
        },
      },
    )
    await connection
      .collection<User>("User")
      .updateOne({ _id: account.user._id }, { $set: { role: EUserRole.ADMIN } })
    const startedAt = Date.now()
    const response = await app.inject({
      method: "PATCH",
      url: "/auth/session/refresh",
      remoteAddress: "8.8.8.8",
      headers: {
        origin: "http://localhost",
        cookie: `__Host-refreshToken=${oldRefresh}`,
      },
    })

    expect(response.statusCode).toBe(204)
    expect(response.body).toBe("")
    expect(response.headers["cache-control"]).toBe("no-store")
    expect(response.cookies).toHaveLength(2)
    for (const [name, maxAge] of [
      ["__Host-accessToken", JWT_ACCESS_EXPIRATION],
      ["__Host-refreshToken", JWT_REFRESH_EXPIRATION],
    ] as const) {
      expect(response.cookies).toContainEqual(
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
    const accessToken =
      response.cookies.find(({ name }) => name === "__Host-accessToken")
        ?.value ?? ""
    const refreshToken =
      response.cookies.find(({ name }) => name === "__Host-refreshToken")
        ?.value ?? ""
    const jwt = app.get(SecurityJwtService)
    expect(await jwt.verifyAccessToken(accessToken)).toMatchObject({
      sub: account.user._id.toHexString(),
      sessionId: account.session._id.toHexString(),
      role: EUserRole.ADMIN,
    })
    expect(await jwt.verifyRefreshToken(refreshToken)).toMatchObject({
      sub: account.user._id.toHexString(),
      sessionId: account.session._id.toHexString(),
    })
    expect(refreshToken).not.toBe(oldRefresh)
    const updated = await sessions.findOne({ _id: account.session._id })
    expect(updated).toMatchObject({
      user: account.user._id,
      createdAt: account.session.createdAt,
      userAgent: account.session.userAgent,
      country: ECountry.RUSSIA,
      refreshTokenHash: createHash("sha256").update(refreshToken).digest("hex"),
    })
    expect(updated?.expiresAt.getTime()).toBeGreaterThanOrEqual(
      startedAt + JWT_REFRESH_EXPIRATION * 1000,
    )
    expect(updated?.expiresAt.getTime()).toBeLessThanOrEqual(
      Date.now() + JWT_REFRESH_EXPIRATION * 1000,
    )
    expect(updated?.lastRefreshedAt?.getTime()).toBeGreaterThanOrEqual(
      startedAt,
    )
    expect(updated?.lastRefreshedAt?.getTime()).toBeLessThanOrEqual(Date.now())
    expect(await sessions.findOne({ _id: extra._id })).toEqual(extra)
    expect(await sessions.countDocuments({ user: account.user._id })).toBe(2)
    expect(
      (
        await app.inject({
          method: "GET",
          url: "/account/whoami",
          headers: { cookie: `__Host-accessToken=${accessToken}` },
        })
      ).statusCode,
    ).toBe(200)
    const replay = await app.inject({
      method: "PATCH",
      url: "/auth/session/refresh",
      headers: account.headers,
    })
    expect(replay.statusCode).toBe(401)
    expect(replay.cookies).toEqual([])
    expect(await sessions.findOne({ _id: account.session._id })).toEqual(
      updated,
    )
    const next = await app.inject({
      method: "PATCH",
      url: "/auth/session/refresh",
      headers: {
        origin: "http://localhost",
        cookie: `__Host-refreshToken=${refreshToken}`,
      },
    })
    expect(next.statusCode).toBe(204)
    expect(
      next.cookies.find(({ name }) => name === "__Host-refreshToken")?.value,
    ).not.toBe(refreshToken)
  })

  it("принимает старый refresh-токен только один раз при одновременных запросах", async () => {
    const { app, connection } = getTestApplication()
    const account = await createAccount()
    const responses = await Promise.all(
      [1, 2].map(async () =>
        app.inject({
          method: "PATCH",
          url: "/auth/session/refresh",
          headers: account.headers,
        }),
      ),
    )

    expect(responses.map(({ statusCode }) => statusCode).sort()).toEqual([
      204, 401,
    ])
    const success = responses.find(({ statusCode }) => statusCode === 204)
    const refresh =
      success?.cookies.find(({ name }) => name === "__Host-refreshToken")
        ?.value ?? ""
    expect(
      responses.find(({ statusCode }) => statusCode === 401)?.cookies,
    ).toEqual([])
    expect(
      await connection
        .collection<UserSession>("UserSession")
        .findOne({ _id: account.session._id }),
    ).toMatchObject({
      refreshTokenHash: createHash("sha256").update(refresh).digest("hex"),
    })
    expect(
      await connection
        .collection<UserSession>("UserSession")
        .countDocuments({}),
    ).toBe(1)
  })

  describe.each([
    { method: "GET", url: "/auth/session" },
    { method: "DELETE", url: "/auth/session/others" },
    { method: "DELETE", url: "/auth/session/507f1f77bcf86cd799439011" },
    { method: "PATCH", url: "/auth/session/refresh" },
  ] as const)("$method $url", ({ method, url }) => {
    it.each([
      "missing-cookie",
      "invalid-token",
      "wrong-cookie",
      "wrong-type",
      "missing-user",
      "missing-session",
      "expired-session",
      "wrong-owner",
      "invalid-claims",
    ])(
      "возвращает 401 без изменения сессий и cookies: %s",
      async (scenario) => {
        const { app, connection } = getTestApplication()
        const account = await createAccount()
        const sessions = connection.collection<UserSession>("UserSession")
        const isRefresh = method === "PATCH"
        const cookieName = isRefresh
          ? "__Host-refreshToken"
          : "__Host-accessToken"
        const otherName = isRefresh
          ? "__Host-accessToken"
          : "__Host-refreshToken"
        const validToken =
          account.headers.cookie
            .split("; ")
            .find((cookie) => cookie.startsWith(`${cookieName}=`))
            ?.slice(cookieName.length + 1) ?? ""
        let cookie = account.headers.cookie
        if (scenario === "missing-cookie") {
          cookie = ""
        } else if (scenario === "invalid-token") {
          cookie = `${cookieName}=invalid-token`
        } else if (scenario === "wrong-cookie") {
          cookie = `${otherName}=${validToken}`
        } else if (scenario === "wrong-type") {
          const otherToken =
            account.headers.cookie
              .split("; ")
              .find((entry) => entry.startsWith(`${otherName}=`))
              ?.slice(otherName.length + 1) ?? ""
          cookie = `${cookieName}=${otherToken}`
        } else if (scenario === "missing-user") {
          await connection
            .collection<User>("User")
            .deleteOne({ _id: account.user._id })
        } else if (scenario === "missing-session") {
          await sessions.deleteOne({ _id: account.session._id })
        } else if (scenario === "expired-session") {
          await sessions.updateOne(
            { _id: account.session._id },
            { $set: { expiresAt: new Date(Date.now() - 1000) } },
          )
        } else if (scenario === "wrong-owner") {
          await sessions.updateOne(
            { _id: account.session._id },
            { $set: { user: new Types.ObjectId() } },
          )
        } else {
          const jwt = app.get(SecurityJwtService)
          const payload = {
            sub: "invalid-user-id",
            sessionId: "invalid-session-id",
            role: account.user.role,
          }
          const token = isRefresh
            ? await jwt.signRefreshToken(payload)
            : await jwt.signAccessToken(payload)
          cookie = `${cookieName}=${token}`
        }
        const before = await sessions.find({}).toArray()
        const response = await app.inject({
          method,
          url,
          headers: {
            origin: "http://localhost",
            cookie,
            authorization: `Bearer ${validToken}`,
          },
        })

        expect(response.statusCode).toBe(401)
        expect(response.cookies).toEqual([])
        expect(await sessions.find({}).toArray()).toEqual(before)
      },
    )
  })

  it.each([
    { method: "DELETE", url: "/auth/session/others" },
    { method: "DELETE", url: "/auth/session/507f1f77bcf86cd799439011" },
    { method: "PATCH", url: "/auth/session/refresh" },
  ] as const)(
    "блокирует посторонний Origin для $method $url без изменения сессий",
    async ({ method, url }) => {
      const { app, connection } = getTestApplication()
      const account = await createAccount()
      const extra = await addSession(account.session)
      const targetUrl = url.endsWith("507f1f77bcf86cd799439011")
        ? `/auth/session/${extra._id.toHexString()}`
        : url
      const before = await connection
        .collection<UserSession>("UserSession")
        .find({})
        .toArray()
      const response = await app.inject({
        method,
        url: targetUrl,
        headers: { ...account.headers, origin: "https://untrusted.example" },
      })

      expect(response.statusCode).toBe(403)
      expect(response.cookies).toEqual([])
      expect(
        await connection
          .collection<UserSession>("UserSession")
          .find({})
          .toArray(),
      ).toEqual(before)
    },
  )
})
