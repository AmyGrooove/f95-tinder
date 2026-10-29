import { createHash } from "node:crypto"

import { describe, expect, it, jest } from "@jest/globals"

import type { User } from "@entities/user/schemas/user.schema"
import type { UserSession } from "@entities/userSession/schemas/userSession.schema"
import { UserSessionRepository } from "@entities/userSession/services/userSession.repository"
import { LoggerService } from "@infrastructure/logger/services/logger.service"
import { compareHash } from "@infrastructure/security/functions/compareHash"
import { hashValue } from "@infrastructure/security/functions/hashValue"
import { getTestApplication } from "@test/setup/setupIntegration"

import { createAccount } from "../../account/__tests__/functions/createAccount"
import { readConfirmationCode } from "../../account/__tests__/functions/readConfirmationCode"
import { PASSWORD_RESET } from "../static/PASSWORD_RESET"
import type { IPasswordReset } from "../types/IPasswordReset"

describe("PasswordResetController HTTP", () => {
  const resetKey = (email: string) => {
    return `bisky-test:auth:passwordReset:{${createHash("sha256").update(email).digest("hex")}}`
  }

  const requestReset = async () => {
    const account = await createAccount("password")
    const email = account.user.email ?? ""
    const response = await getTestApplication().app.inject({
      method: "POST",
      url: "/auth/password/reset",
      headers: { origin: "http://localhost" },
      payload: { email },
    })
    expect(response.statusCode).toBe(204)

    return {
      ...account,
      email,
      code: readConfirmationCode(),
      key: resetKey(email),
    }
  }

  it("нормализует email, отправляет код и сохраняет ограниченное по времени подтверждение без изменения аккаунта", async () => {
    const { app, connection, redis, mail } = getTestApplication()
    const { user, session } = await createAccount("password")
    const email = user.email ?? ""
    const response = await app.inject({
      method: "POST",
      url: "/auth/password/reset",
      headers: { origin: "http://localhost" },
      payload: { email: `  ${email.toUpperCase()}  ` },
    })

    expect(response.statusCode).toBe(204)
    expect(response.body).toBe("")
    expect(response.headers["cache-control"]).toBe("no-store")
    expect(response.cookies).toEqual([])
    expect(mail.messages).toHaveLength(1)
    expect(mail.messages[0]).toMatchObject({ to: email })
    const code = readConfirmationCode()
    const key = resetKey(email)
    const pending: IPasswordReset = JSON.parse((await redis.get(key)) ?? "null")
    expect(pending).toMatchObject({
      userId: user._id.toHexString(),
      email,
      passwordHash: user.passwordHash,
      attemptsRemaining: PASSWORD_RESET.attempts,
    })
    expect(await compareHash(code, pending.codeHash)).toBe(true)
    expect(await redis.ttl(key)).toBeGreaterThan(0)
    expect(await redis.ttl(key)).toBeLessThanOrEqual(
      PASSWORD_RESET.expirationSeconds,
    )
    expect(await redis.ttl(`${key}:cooldown`)).toBeGreaterThan(0)
    expect(await redis.ttl(`${key}:cooldown`)).toBeLessThanOrEqual(
      PASSWORD_RESET.resendSeconds,
    )
    expect(
      await connection.collection<User>("User").findOne({ _id: user._id }),
    ).toEqual(user)
    expect(
      await connection
        .collection<UserSession>("UserSession")
        .findOne({ _id: session._id }),
    ).toEqual(session)
  })

  it.each(["unknown", "without-password"])(
    "возвращает такой же пустой ответ для аккаунта %s без письма",
    async (kind) => {
      const { app, connection, redis, mail } = getTestApplication()
      const account = await createAccount()
      const email = "unknown@example.test"
      if (kind === "without-password") {
        await connection
          .collection<User>("User")
          .updateOne({ _id: account.user._id }, { $set: { email } })
      }
      const before = await connection
        .collection<User>("User")
        .findOne({ _id: account.user._id })
      const response = await app.inject({
        method: "POST",
        url: "/auth/password/reset",
        headers: { origin: "http://localhost" },
        payload: { email },
      })

      expect(response.statusCode).toBe(204)
      expect(response.body).toBe("")
      expect(response.headers["cache-control"]).toBe("no-store")
      expect(response.cookies).toEqual([])
      expect(mail.messages).toHaveLength(0)
      expect(await redis.exists(resetKey(email))).toBe(0)
      expect(await redis.ttl(`${resetKey(email)}:cooldown`)).toBeGreaterThan(0)
      expect(
        await connection
          .collection<User>("User")
          .findOne({ _id: account.user._id }),
      ).toEqual(before)
      expect(
        await connection
          .collection<UserSession>("UserSession")
          .countDocuments({}),
      ).toBe(1)
    },
  )

  it("не отправляет повторное письмо и не заменяет подтверждение во время паузы", async () => {
    const { app, redis, mail } = getTestApplication()
    const { email, key } = await requestReset()
    const before = await redis.get(key)
    const ttl = await redis.ttl(key)
    const response = await app.inject({
      method: "POST",
      url: "/auth/password/reset",
      headers: { origin: "http://localhost" },
      payload: { email },
    })

    expect(response.statusCode).toBe(204)
    expect(response.body).toBe("")
    expect(response.cookies).toEqual([])
    expect(mail.messages).toHaveLength(1)
    expect(await redis.get(key)).toBe(before)
    expect(await redis.ttl(key)).toBeLessThanOrEqual(ttl)
  })

  it("сохраняет ответ 204 при сбое отправки письма, удаляя подтверждение и сохраняя паузу", async () => {
    const { app, redis, mail, connection } = getTestApplication()
    const { user, session } = await createAccount("password")
    const email = user.email ?? ""
    const error = new Error("Mail unavailable")
    jest.spyOn(mail, "send").mockRejectedValue(error)
    const log = jest
      .spyOn(app.get(LoggerService), "error")
      .mockImplementation(() => undefined)
    const response = await app.inject({
      method: "POST",
      url: "/auth/password/reset",
      headers: { origin: "http://localhost" },
      payload: { email },
    })

    expect(response.statusCode).toBe(204)
    expect(response.body).toBe("")
    expect(response.cookies).toEqual([])
    expect(log).toHaveBeenCalledWith(expect.any(String), error)
    expect(await redis.exists(resetKey(email))).toBe(0)
    expect(await redis.ttl(`${resetKey(email)}:cooldown`)).toBeGreaterThan(0)
    expect(
      await connection.collection<User>("User").findOne({ _id: user._id }),
    ).toEqual(user)
    expect(
      await connection
        .collection<UserSession>("UserSession")
        .findOne({ _id: session._id }),
    ).toEqual(session)
  })

  it("меняет пароль без авторизации, отзывает все сессии пользователя и очищает cookies", async () => {
    const { app, connection, redis } = getTestApplication()
    const account = await requestReset()
    const other = await createAccount()
    const login = await app.inject({
      method: "POST",
      url: "/auth/login",
      headers: { origin: "http://localhost" },
      payload: { username: account.user.username, password: account.password },
    })
    expect(login.statusCode).toBe(204)
    expect(
      await connection
        .collection<UserSession>("UserSession")
        .countDocuments({ user: account.user._id }),
    ).toBe(2)
    const newPassword = " New-password-123 "
    const response = await app.inject({
      method: "PATCH",
      url: "/auth/password/reset",
      headers: { origin: "http://localhost" },
      payload: {
        email: ` ${account.email.toUpperCase()} `,
        code: account.code,
        newPassword,
      },
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
      expect(
        response.cookies
          .find((cookie) => cookie.name === name)
          ?.expires?.getTime(),
      ).toBeLessThanOrEqual(Date.now())
    }
    const updated = await connection
      .collection<User>("User")
      .findOne({ _id: account.user._id })
    expect(updated).toMatchObject({
      email: account.email,
      username: account.user.username,
    })
    expect(await compareHash(newPassword, updated?.passwordHash ?? "")).toBe(
      true,
    )
    expect(
      await compareHash(newPassword.trim(), updated?.passwordHash ?? ""),
    ).toBe(false)
    expect(
      await compareHash(account.password, updated?.passwordHash ?? ""),
    ).toBe(false)
    expect(await redis.exists(account.key)).toBe(0)
    expect(
      await connection
        .collection<UserSession>("UserSession")
        .countDocuments({ user: account.user._id }),
    ).toBe(0)
    expect(
      await connection
        .collection<UserSession>("UserSession")
        .findOne({ _id: other.session._id }),
    ).toEqual(other.session)
    for (const cookie of [
      account.headers.cookie,
      login.cookies.map(({ name, value }) => `${name}=${value}`).join("; "),
    ]) {
      expect(
        (
          await app.inject({
            method: "GET",
            url: "/account/whoami",
            headers: { cookie },
          })
        ).statusCode,
      ).toBe(401)
    }
    const repeated = await app.inject({
      method: "PATCH",
      url: "/auth/password/reset",
      headers: { origin: "http://localhost" },
      payload: { email: account.email, code: account.code, newPassword },
    })
    expect(repeated.statusCode).toBe(400)
    expect(repeated.cookies).toEqual([])
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/auth/login",
          headers: { origin: "http://localhost" },
          payload: { username: account.user.username, password: newPassword },
        })
      ).statusCode,
    ).toBe(204)
  })

  it("уменьшает число попыток без продления срока и принимает верный код после ошибки", async () => {
    const { app, redis, connection } = getTestApplication()
    const account = await requestReset()
    const ttl = await redis.ttl(account.key)
    const payload = {
      email: account.email,
      code: account.code === "000000" ? "000001" : "000000",
      newPassword: "New-password-123",
    }
    const rejected = await app.inject({
      method: "PATCH",
      url: "/auth/password/reset",
      headers: { origin: "http://localhost" },
      payload,
    })

    expect(rejected.statusCode).toBe(400)
    expect(rejected.cookies).toEqual([])
    expect(JSON.parse((await redis.get(account.key)) ?? "null")).toMatchObject({
      attemptsRemaining: PASSWORD_RESET.attempts - 1,
    })
    expect(await redis.ttl(account.key)).toBeLessThanOrEqual(ttl)
    expect(
      await connection
        .collection<User>("User")
        .findOne({ _id: account.user._id }),
    ).toEqual(account.user)
    expect(
      await connection
        .collection<UserSession>("UserSession")
        .findOne({ _id: account.session._id }),
    ).toEqual(account.session)
    expect(
      (
        await app.inject({
          method: "PATCH",
          url: "/auth/password/reset",
          headers: { origin: "http://localhost" },
          payload: { ...payload, code: account.code },
        })
      ).statusCode,
    ).toBe(204)
  })

  it.each([
    "missing",
    "expired",
    "exhausted",
    "email-changed",
    "password-changed",
  ])(
    "отклоняет недействующее подтверждение: %s без изменения пароля и сессий",
    async (scenario) => {
      const { app, redis, connection } = getTestApplication()
      const account = await requestReset()
      const payload = {
        email: account.email,
        code: account.code,
        newPassword: "New-password-123",
      }
      if (scenario === "missing") {
        payload.email = "other@example.test"
      } else if (scenario === "expired") {
        await redis.expire(account.key, 0)
      } else if (scenario === "exhausted") {
        for (let index = 0; index < PASSWORD_RESET.attempts; index += 1) {
          const response = await app.inject({
            method: "PATCH",
            url: "/auth/password/reset",
            headers: { origin: "http://localhost" },
            payload: {
              ...payload,
              code: account.code === "000000" ? "000001" : "000000",
            },
          })
          expect(response.statusCode).toBe(400)
        }
        expect(await redis.exists(account.key)).toBe(0)
      } else {
        await connection.collection<User>("User").updateOne(
          { _id: account.user._id },
          {
            $set:
              scenario === "email-changed"
                ? { email: "changed@example.test" }
                : { passwordHash: await hashValue("Changed-password-123") },
          },
        )
      }
      const before = await connection
        .collection<User>("User")
        .findOne({ _id: account.user._id })
      const response = await app.inject({
        method: "PATCH",
        url: "/auth/password/reset",
        headers: { origin: "http://localhost" },
        payload,
      })

      expect(response.statusCode).toBe(400)
      expect(response.cookies).toEqual([])
      expect(
        await connection
          .collection<User>("User")
          .findOne({ _id: account.user._id }),
      ).toEqual(before)
      expect(
        await connection
          .collection<UserSession>("UserSession")
          .findOne({ _id: account.session._id }),
      ).toEqual(account.session)
    },
  )

  it("откатывает смену пароля при ошибке удаления сессий и не очищает cookies", async () => {
    const { app, connection, redis } = getTestApplication()
    const account = await requestReset()
    jest
      .spyOn(app.get(UserSessionRepository), "deleteByUser")
      .mockRejectedValue(new Error("Delete failed"))
    jest
      .spyOn(app.get(LoggerService), "error")
      .mockImplementation(() => undefined)
    const response = await app.inject({
      method: "PATCH",
      url: "/auth/password/reset",
      headers: { origin: "http://localhost" },
      payload: {
        email: account.email,
        code: account.code,
        newPassword: "New-password-123",
      },
    })

    expect(response.statusCode).toBe(500)
    expect(response.cookies).toEqual([])
    expect(
      await connection
        .collection<User>("User")
        .findOne({ _id: account.user._id }),
    ).toEqual(account.user)
    expect(
      await connection
        .collection<UserSession>("UserSession")
        .findOne({ _id: account.session._id }),
    ).toEqual(account.session)
    expect(await redis.exists(account.key)).toBe(0)
  })

  it.each([
    { method: "POST", payload: {} },
    { method: "POST", payload: { email: "invalid" } },
    { method: "POST", payload: { email: 123 } },
    { method: "POST", payload: { email: "user@example.test", extra: true } },
    {
      method: "PATCH",
      payload: { email: "user@example.test", code: "123456" },
    },
    {
      method: "PATCH",
      payload: {
        email: "invalid",
        code: "123456",
        newPassword: "New-password-123",
      },
    },
    {
      method: "PATCH",
      payload: {
        email: "user@example.test",
        code: 123456,
        newPassword: "New-password-123",
      },
    },
    {
      method: "PATCH",
      payload: {
        email: "user@example.test",
        code: "12345",
        newPassword: "New-password-123",
      },
    },
    {
      method: "PATCH",
      payload: {
        email: "user@example.test",
        code: "1234567",
        newPassword: "New-password-123",
      },
    },
    {
      method: "PATCH",
      payload: {
        email: "user@example.test",
        code: "abcdef",
        newPassword: "New-password-123",
      },
    },
    {
      method: "PATCH",
      payload: {
        email: "user@example.test",
        code: "123456",
        newPassword: "short",
      },
    },
    {
      method: "PATCH",
      payload: {
        email: "user@example.test",
        code: "123456",
        newPassword: "я".repeat(37),
      },
    },
    {
      method: "PATCH",
      payload: {
        email: "user@example.test",
        code: "123456",
        newPassword: "New-password-123",
        extra: true,
      },
    },
  ] as const)(
    "возвращает 400 для некорректного тела $method: $payload",
    async ({ method, payload }) => {
      const { app, mail, connection } = getTestApplication()
      const response = await app.inject({
        method,
        url: "/auth/password/reset",
        headers: { origin: "http://localhost" },
        payload,
      })

      expect(response.statusCode).toBe(400)
      expect(response.cookies).toEqual([])
      expect(mail.messages).toHaveLength(0)
      expect(await connection.collection<User>("User").countDocuments({})).toBe(
        0,
      )
    },
  )

  it.each(["POST", "PATCH"] as const)(
    "блокирует посторонний Origin для %s до изменения подтверждения",
    async (method) => {
      const { app, redis, mail, connection } = getTestApplication()
      const account = await requestReset()
      await redis.del(`${account.key}:cooldown`)
      const before = await redis.get(account.key)
      const response = await app.inject({
        method,
        url: "/auth/password/reset",
        headers: { origin: "https://untrusted.example" },
        payload:
          method === "POST"
            ? { email: account.email }
            : {
                email: account.email,
                code: account.code,
                newPassword: "New-password-123",
              },
      })

      expect(response.statusCode).toBe(403)
      expect(response.cookies).toEqual([])
      expect(mail.messages).toHaveLength(1)
      expect(await redis.get(account.key)).toBe(before)
      expect(
        await connection
          .collection<User>("User")
          .findOne({ _id: account.user._id }),
      ).toEqual(account.user)
      expect(
        await connection
          .collection<UserSession>("UserSession")
          .findOne({ _id: account.session._id }),
      ).toEqual(account.session)
    },
  )

  it.each(["POST", "PATCH"] as const)(
    "возвращает 429 после пяти запросов %s",
    async (method) => {
      const { app, mail } = getTestApplication()
      const request = {
        method,
        url: "/auth/password/reset",
        headers: { origin: "http://localhost" },
        payload:
          method === "POST"
            ? { email: "unknown@example.test" }
            : {
                email: "unknown@example.test",
                code: "123456",
                newPassword: "New-password-123",
              },
      }
      for (let index = 0; index < 5; index += 1) {
        expect((await app.inject(request)).statusCode).toBe(
          method === "POST" ? 204 : 400,
        )
      }
      const response = await app.inject(request)
      expect(response.statusCode).toBe(429)
      expect(response.cookies).toEqual([])
      expect(mail.messages).toHaveLength(0)
    },
  )
})
