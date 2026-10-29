import { createHash } from "node:crypto"
import { describe, expect, it, jest } from "@jest/globals"

import type { User } from "@entities/user/schemas/user.schema"
import type { UserSession } from "@entities/userSession/schemas/userSession.schema"
import { UserSessionRepository } from "@entities/userSession/services/userSession.repository"
import { compareHash } from "@infrastructure/security/functions/compareHash"
import { getTestApplication } from "@test/setup/setupIntegration"

import { createAccount } from "./functions/createAccount"

describe("AccountCredentialsController HTTP", () => {
  it.each(["password", "accessCode"] as const)(
    "откатывает смену секрета %s и текущего токена при сбое отзыва остальных сессий",
    async (kind) => {
      const { app, connection } = getTestApplication()
      const account = await createAccount(
        kind === "password" ? "password" : "anonymous",
      )
      const login = await app.inject({
        method: "POST",
        url: kind === "password" ? "/auth/login" : "/auth/login/code",
        headers: { origin: account.headers.origin },
        payload:
          kind === "password"
            ? { username: account.user.username, password: account.password }
            : { accessCode: account.accessCode },
      })
      expect(login.statusCode).toBe(204)
      const beforeUser = await connection
        .collection("User")
        .findOne({ _id: account.user._id })
      const beforeSessions = await connection
        .collection("UserSession")
        .find({ user: account.user._id })
        .sort({ _id: 1 })
        .toArray()
      expect(beforeSessions).toHaveLength(2)
      const repository = app.get(UserSessionRepository)
      const remove = repository.deleteOthers.bind(repository)
      const failure = jest
        .spyOn(repository, "deleteOthers")
        .mockImplementationOnce(async (...args) => {
          await remove(...args)
          throw new Error("session revocation failed")
        })
      const request = {
        method: "PATCH" as const,
        url: kind === "password" ? "/account/password" : "/auth/login/code",
        headers: account.headers,
        payload:
          kind === "password"
            ? {
                currentPassword: account.password,
                newPassword: "New-password-123",
              }
            : { accessCode: account.accessCode },
      }
      const response = await app.inject(request)
      expect(response.statusCode).toBe(500)
      expect(response.headers["set-cookie"]).toBeUndefined()
      expect(
        await connection.collection("User").findOne({ _id: account.user._id }),
      ).toEqual(beforeUser)
      expect(
        await connection
          .collection("UserSession")
          .find({ user: account.user._id })
          .sort({ _id: 1 })
          .toArray(),
      ).toEqual(beforeSessions)
      failure.mockRestore()
      expect((await app.inject(request)).statusCode).toBe(
        kind === "password" ? 204 : 200,
      )
    },
  )

  it("меняет пароль, обновляет cookies и текущую сессию, удаляет остальные сессии", async () => {
    const { app, connection } = getTestApplication()
    const { user, session, headers, password } = await createAccount("password")
    const otherLogin = await app.inject({
      method: "POST",
      url: "/auth/login",
      headers: { origin: headers.origin },
      payload: { username: user.username, password },
    })
    expect(otherLogin.statusCode).toBe(204)
    expect(
      await connection
        .collection<UserSession>("UserSession")
        .countDocuments({ user: user._id }),
    ).toBe(2)

    const response = await app.inject({
      method: "PATCH",
      url: "/account/password",
      headers,
      payload: { currentPassword: password, newPassword: "New-password-123" },
    })

    expect(response.statusCode).toBe(204)
    expect(response.body).toBe("")
    expect(response.headers["cache-control"]).toBe("no-store")
    expect(response.headers["set-cookie"]).toEqual(
      expect.arrayContaining([
        expect.stringMatching(
          /^__Host-accessToken=.+;.*HttpOnly;.*Secure;.*SameSite=Strict/,
        ),
        expect.stringMatching(
          /^__Host-refreshToken=.+;.*HttpOnly;.*Secure;.*SameSite=Strict/,
        ),
      ]),
    )
    const updatedUser = await connection
      .collection<User>("User")
      .findOne({ _id: user._id })
    expect(
      await compareHash("New-password-123", updatedUser?.passwordHash ?? ""),
    ).toBe(true)
    expect(await compareHash(password, updatedUser?.passwordHash ?? "")).toBe(
      false,
    )
    const sessions = await connection
      .collection<UserSession>("UserSession")
      .find({ user: user._id })
      .toArray()
    const refreshToken = response.cookies.find(
      ({ name }) => name === "__Host-refreshToken",
    )?.value
    expect(refreshToken).toEqual(expect.any(String))
    expect(sessions).toHaveLength(1)
    expect(sessions[0]).toMatchObject({
      _id: session._id,
      refreshTokenHash: createHash("sha256")
        .update(refreshToken ?? "")
        .digest("hex"),
    })
    expect(sessions[0]?.refreshTokenHash).not.toBe(session.refreshTokenHash)

    const revoked = await app.inject({
      method: "GET",
      url: "/account/whoami",
      headers: {
        cookie: otherLogin.cookies
          .map(({ name, value }) => `${name}=${value}`)
          .join("; "),
      },
    })
    expect(revoked.statusCode).toBe(401)
    const current = await app.inject({
      method: "GET",
      url: "/account/whoami",
      headers: {
        cookie: response.cookies
          .map(({ name, value }) => `${name}=${value}`)
          .join("; "),
      },
    })
    expect(current.statusCode).toBe(200)
  })

  it("не меняет пароль и cookies при неверном текущем пароле", async () => {
    const { app, connection } = getTestApplication()
    const { user, session, headers } = await createAccount("password")
    const response = await app.inject({
      method: "PATCH",
      url: "/account/password",
      headers,
      payload: {
        currentPassword: "wrong-password",
        newPassword: "New-password-123",
      },
    })

    expect(response.statusCode).toBe(401)
    expect(response.headers["set-cookie"]).toBeUndefined()
    expect(
      await connection.collection<User>("User").findOne({ _id: user._id }),
    ).toMatchObject({ passwordHash: user.passwordHash })
    expect(
      await connection
        .collection<UserSession>("UserSession")
        .findOne({ _id: session._id }),
    ).toMatchObject({ refreshTokenHash: session.refreshTokenHash })
  })

  it("возвращает 409 при смене пароля аккаунта без установленного пароля", async () => {
    const { app } = getTestApplication()
    const { headers } = await createAccount()
    const response = await app.inject({
      method: "PATCH",
      url: "/account/password",
      headers,
      payload: {
        currentPassword: "old-password",
        newPassword: "New-password-123",
      },
    })

    expect(response.statusCode).toBe(409)
    expect(response.headers["set-cookie"]).toBeUndefined()
  })

  it("перевыпускает код и cookies, сохраняет новый хеш и отзывает остальные сессии", async () => {
    const { app, connection } = getTestApplication()
    const { user, session, headers, accessCode } = await createAccount()
    const otherLogin = await app.inject({
      method: "POST",
      url: "/auth/login/code",
      headers: { origin: headers.origin },
      payload: { accessCode },
    })
    expect(otherLogin.statusCode).toBe(204)
    const response = await app.inject({
      method: "PATCH",
      url: "/auth/login/code",
      headers,
      payload: { accessCode },
    })

    expect(response.statusCode).toBe(200)
    expect(response.headers["cache-control"]).toBe("no-store")
    const result = response.json<{ accessCode: string }>()
    expect(result).toEqual({
      accessCode: expect.stringMatching(/^[A-Za-z0-9_-]{32}$/),
    })
    expect(result.accessCode).not.toBe(accessCode)
    expect(response.headers["set-cookie"]).toEqual(
      expect.arrayContaining([
        expect.stringMatching(
          /^__Host-accessToken=.+;.*HttpOnly;.*Secure;.*SameSite=Strict/,
        ),
        expect.stringMatching(
          /^__Host-refreshToken=.+;.*HttpOnly;.*Secure;.*SameSite=Strict/,
        ),
      ]),
    )
    expect(
      await connection.collection<User>("User").findOne({ _id: user._id }),
    ).toMatchObject({
      accessCodeHash: createHash("sha256")
        .update(result.accessCode)
        .digest("hex"),
    })
    const sessions = await connection
      .collection<UserSession>("UserSession")
      .find({ user: user._id })
      .toArray()
    expect(sessions).toHaveLength(1)
    expect(sessions[0]?._id).toEqual(session._id)
    expect(sessions[0]?.refreshTokenHash).not.toBe(session.refreshTokenHash)
    const revoked = await app.inject({
      method: "GET",
      url: "/account/whoami",
      headers: {
        cookie: otherLogin.cookies
          .map(({ name, value }) => `${name}=${value}`)
          .join("; "),
      },
    })
    expect(revoked.statusCode).toBe(401)
    const oldCode = await app.inject({
      method: "POST",
      url: "/auth/login/code",
      headers,
      payload: { accessCode },
    })
    expect(oldCode.statusCode).toBe(401)
    const newCode = await app.inject({
      method: "POST",
      url: "/auth/login/code",
      headers,
      payload: result,
    })
    expect(newCode.statusCode).toBe(204)
  })

  it("не меняет код, сессию и cookies при неверном коде доступа", async () => {
    const { app, connection } = getTestApplication()
    const { user, session, headers, accessCode } = await createAccount()
    const wrongCode = `${accessCode[0] === "a" ? "b" : "a"}${accessCode.slice(1)}`
    const response = await app.inject({
      method: "PATCH",
      url: "/auth/login/code",
      headers,
      payload: { accessCode: wrongCode },
    })

    expect(response.statusCode).toBe(401)
    expect(response.headers["set-cookie"]).toBeUndefined()
    expect(
      await connection.collection<User>("User").findOne({ _id: user._id }),
    ).toMatchObject({ accessCodeHash: user.accessCodeHash })
    expect(
      await connection
        .collection<UserSession>("UserSession")
        .findOne({ _id: session._id }),
    ).toMatchObject({ refreshTokenHash: session.refreshTokenHash })
  })

  it("возвращает 429 после пяти запросов перевыпуска кода через Redis throttling", async () => {
    const { app } = getTestApplication()
    const request = {
      method: "PATCH" as const,
      url: "/auth/login/code",
      headers: { origin: "http://localhost" },
      payload: { accessCode: "a".repeat(32) },
    }

    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect((await app.inject(request)).statusCode).toBe(401)
    }

    const response = await app.inject(request)

    expect(response.statusCode).toBe(429)
    expect(response.headers["set-cookie"]).toBeUndefined()
  })

  it.each([
    {
      url: "/account/password",
      payload: { currentPassword: "password", newPassword: "short" },
    },
    { url: "/auth/login/code", payload: { accessCode: "short" } },
  ])("отклоняет некорректное тело для $url", async ({ url, payload }) => {
    const { app } = getTestApplication()
    const { headers } = await createAccount()
    const response = await app.inject({
      method: "PATCH",
      url,
      headers,
      payload,
    })

    expect(response.statusCode).toBe(400)
    expect(response.headers["set-cookie"]).toBeUndefined()
  })

  it.each([
    {
      url: "/account/password",
      payload: { currentPassword: "password", newPassword: "new-password" },
    },
    { url: "/auth/login/code", payload: { accessCode: "a".repeat(32) } },
  ])("возвращает 401 без cookies для $url", async ({ url, payload }) => {
    const response = await getTestApplication().app.inject({
      method: "PATCH",
      url,
      headers: { origin: "http://localhost" },
      payload,
    })

    expect(response.statusCode).toBe(401)
    expect(response.headers["set-cookie"]).toBeUndefined()
  })
})
