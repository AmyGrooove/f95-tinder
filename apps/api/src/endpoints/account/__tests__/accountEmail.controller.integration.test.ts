import { describe, expect, it, jest } from "@jest/globals"

import type { User } from "@entities/user/schemas/user.schema"
import { hashValue } from "@infrastructure/security/functions/hashValue"
import { LoggerService } from "@infrastructure/logger/services/logger.service"
import { getTestApplication } from "@test/setup/setupIntegration"

import { createAccount } from "./functions/createAccount"
import { readConfirmationCode } from "./functions/readConfirmationCode"

describe("AccountEmailController HTTP", () => {
  it("отправляет письмо и меняет email в MongoDB только после подтверждения, удаляя заявку Redis", async () => {
    const { app, connection, redis, mail } = getTestApplication()
    const { user, headers, password } = await createAccount("password")
    const key = `bisky-test:account:email:{${user._id.toHexString()}}`
    const requested = await app.inject({
      method: "POST",
      url: "/account/email",
      headers,
      payload: { email: "  NEW@EXAMPLE.COM  ", currentPassword: password },
    })

    expect(requested.statusCode).toBe(204)
    expect(requested.body).toBe("")
    expect(requested.headers["cache-control"]).toBe("no-store")
    expect(mail.messages).toHaveLength(1)
    expect(mail.messages[0]).toMatchObject({ to: "new@example.com" })
    expect(await redis.ttl(key)).toBeGreaterThan(0)
    expect(await redis.ttl(key)).toBeLessThanOrEqual(4 * 60 * 60)
    expect(await redis.ttl(`${key}:cooldown`)).toBeGreaterThan(0)
    expect(await redis.ttl(`${key}:cooldown`)).toBeLessThanOrEqual(60)
    expect(
      await connection.collection<User>("User").findOne({ _id: user._id }),
    ).toMatchObject({ email: user.email })
    const code = readConfirmationCode()
    const confirmed = await app.inject({
      method: "PATCH",
      url: "/account/email",
      headers,
      payload: { code },
    })

    expect(confirmed.statusCode).toBe(204)
    expect(confirmed.body).toBe("")
    expect(confirmed.headers["cache-control"]).toBe("no-store")
    expect(await redis.exists(key)).toBe(0)
    expect(
      await connection.collection<User>("User").findOne({ _id: user._id }),
    ).toMatchObject({
      email: "new@example.com",
      passwordHash: user.passwordHash,
    })
    const repeated = await app.inject({
      method: "PATCH",
      url: "/account/email",
      headers,
      payload: { code },
    })
    expect(repeated.statusCode).toBe(400)
  })

  it("не меняет email при неверном коде и позволяет подтвердить верный код", async () => {
    const { app, connection } = getTestApplication()
    const { user, headers, password } = await createAccount("password")
    const requested = await app.inject({
      method: "POST",
      url: "/account/email",
      headers,
      payload: { email: "new@example.com", currentPassword: password },
    })
    expect(requested.statusCode).toBe(204)
    const code = readConfirmationCode()
    const rejected = await app.inject({
      method: "PATCH",
      url: "/account/email",
      headers,
      payload: { code: code === "000000" ? "000001" : "000000" },
    })

    expect(rejected.statusCode).toBe(400)
    expect(
      await connection.collection<User>("User").findOne({ _id: user._id }),
    ).toMatchObject({ email: user.email })
    const confirmed = await app.inject({
      method: "PATCH",
      url: "/account/email",
      headers,
      payload: { code },
    })
    expect(confirmed.statusCode).toBe(204)
  })

  it("возвращает 401 при неверном пароле без письма и заявки в Redis", async () => {
    const { app, connection, redis, mail } = getTestApplication()
    const { user, headers } = await createAccount("password")
    const response = await app.inject({
      method: "POST",
      url: "/account/email",
      headers,
      payload: { email: "new@example.com", currentPassword: "wrong-password" },
    })

    expect(response.statusCode).toBe(401)
    expect(mail.messages).toHaveLength(0)
    expect(
      await redis.exists(
        `bisky-test:account:email:{${user._id.toHexString()}}`,
      ),
    ).toBe(0)
    expect(
      await connection.collection<User>("User").findOne({ _id: user._id }),
    ).toMatchObject({ email: user.email })
  })

  it.each(["email-taken", "password-changed", "email-changed"])(
    "отклоняет подтверждение смены email после изменения данных: %s",
    async (scenario) => {
      const { app, connection, redis } = getTestApplication()
      const { user, headers, password } = await createAccount("password")
      const users = connection.collection<User>("User")
      const requested = await app.inject({
        method: "POST",
        url: "/account/email",
        headers,
        payload: { email: "new@example.com", currentPassword: password },
      })
      expect(requested.statusCode).toBe(204)
      const code = readConfirmationCode()

      if (scenario === "email-taken") {
        const other = await createAccount("password")
        await users.updateOne(
          { _id: other.user._id },
          { $set: { email: "new@example.com" } },
        )
      } else {
        await users.updateOne(
          { _id: user._id },
          {
            $set:
              scenario === "password-changed"
                ? { passwordHash: await hashValue("Changed-password-123") }
                : { email: "changed@example.com" },
          },
        )
      }

      const before = await users.find({}).toArray()
      const response = await app.inject({
        method: "PATCH",
        url: "/account/email",
        headers,
        payload: { code },
      })

      expect(response.statusCode).toBe(scenario === "email-taken" ? 409 : 400)
      expect(response.cookies).toEqual([])
      expect(await users.find({}).toArray()).toEqual(before)
      expect(
        await redis.exists(
          `bisky-test:account:email:{${user._id.toHexString()}}`,
        ),
      ).toBe(0)
    },
  )

  it.each(["expired", "exhausted"])(
    "не меняет email по недействующей заявке: %s",
    async (scenario) => {
      const { app, connection, redis } = getTestApplication()
      const { user, headers, password } = await createAccount("password")
      const key = `bisky-test:account:email:{${user._id.toHexString()}}`
      const requested = await app.inject({
        method: "POST",
        url: "/account/email",
        headers,
        payload: { email: "new@example.com", currentPassword: password },
      })
      expect(requested.statusCode).toBe(204)
      const code = readConfirmationCode()

      if (scenario === "expired") {
        await redis.expire(key, 0)
      } else {
        for (let attempt = 0; attempt < 3; attempt += 1) {
          const response = await app.inject({
            method: "PATCH",
            url: "/account/email",
            headers,
            payload: { code: code === "000000" ? "000001" : "000000" },
          })
          expect(response.statusCode).toBe(400)
        }
      }

      expect(await redis.exists(key)).toBe(0)
      const response = await app.inject({
        method: "PATCH",
        url: "/account/email",
        headers,
        payload: { code },
      })

      expect(response.statusCode).toBe(400)
      expect(response.cookies).toEqual([])
      expect(
        await connection.collection<User>("User").findOne({ _id: user._id }),
      ).toEqual(user)
    },
  )

  it("возвращает 409 для занятого email без отправки письма", async () => {
    const { app, mail } = getTestApplication()
    const existing = await createAccount("password")
    const { headers, password } = await createAccount("password")
    const response = await app.inject({
      method: "POST",
      url: "/account/email",
      headers,
      payload: { email: existing.user.email, currentPassword: password },
    })

    expect(response.statusCode).toBe(409)
    expect(mail.messages).toHaveLength(0)
  })

  it.each(["POST", "PATCH"] as const)(
    "возвращает 409 для ненастроенного аккаунта при %s /account/email",
    async (method) => {
      const { app, mail } = getTestApplication()
      const { headers, password } = await createAccount()
      const response = await app.inject({
        method,
        url: "/account/email",
        headers,
        payload:
          method === "POST"
            ? { email: "new@example.com", currentPassword: password }
            : { code: "123456" },
      })

      expect(response.statusCode).toBe(409)
      expect(mail.messages).toHaveLength(0)
    },
  )

  it("ограничивает повторную отправку через Redis и не отправляет второе письмо", async () => {
    const { app, mail } = getTestApplication()
    const { headers, password } = await createAccount("password")
    const request = {
      method: "POST" as const,
      url: "/account/email",
      headers,
      payload: { email: "new@example.com", currentPassword: password },
    }

    expect((await app.inject(request)).statusCode).toBe(204)
    expect((await app.inject(request)).statusCode).toBe(429)
    expect(mail.messages).toHaveLength(1)
  })

  it("при сбое почты возвращает 503, удаляет заявку и позволяет повторную отправку", async () => {
    const { app, redis, mail } = getTestApplication()
    const { user, headers, password } = await createAccount("password")
    const logError = jest
      .spyOn(app.get(LoggerService), "error")
      .mockImplementation(() => {})
    jest
      .spyOn(mail, "send")
      .mockRejectedValueOnce(new Error("Тестовый сбой почты"))
    const request = {
      method: "POST" as const,
      url: "/account/email",
      headers,
      payload: { email: "new@example.com", currentPassword: password },
    }
    const response = await app.inject(request)

    expect(response.statusCode).toBe(503)
    expect(logError).toHaveBeenCalledTimes(1)
    expect(logError).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        name: "ServiceUnavailableException",
        cause: expect.objectContaining({ message: "Тестовый сбой почты" }),
      }),
      expect.objectContaining({ context: "AppExceptionFilter" }),
    )
    expect(mail.messages).toHaveLength(0)
    const key = `bisky-test:account:email:{${user._id.toHexString()}}`
    expect(await redis.exists([key, `${key}:cooldown`])).toBe(0)
    expect((await app.inject(request)).statusCode).toBe(204)
    expect(mail.messages).toHaveLength(1)
  })

  it.each(["POST", "PATCH"] as const)(
    "возвращает 401 без cookies для %s /account/email",
    async (method) => {
      const response = await getTestApplication().app.inject({
        method,
        url: "/account/email",
        headers: { origin: "http://localhost" },
        payload:
          method === "POST"
            ? { email: "new@example.com", currentPassword: "password123" }
            : { code: "123456" },
      })

      expect(response.statusCode).toBe(401)
    },
  )

  it.each([
    { email: "invalid" },
    { email: 123 },
    { email: null },
    { currentPassword: "short" },
    { currentPassword: "я".repeat(37) },
    { currentPassword: 123 },
    { currentPassword: null },
    { extra: true },
  ])(
    "отклоняет отдельное некорректное поле запроса смены email: %j",
    async (invalidField) => {
      const { app, mail, connection, redis } = getTestApplication()
      const { user, headers, password } = await createAccount("password")
      const response = await app.inject({
        method: "POST",
        url: "/account/email",
        headers,
        payload: {
          email: "new@example.com",
          currentPassword: password,
          ...invalidField,
        },
      })

      expect(response.statusCode).toBe(400)
      expect(response.json()).toMatchObject({
        error: { details: { errors: expect.any(Array) } },
      })
      expect(response.cookies).toEqual([])
      expect(mail.messages).toHaveLength(0)
      expect(
        await redis.exists(
          `bisky-test:account:email:{${user._id.toHexString()}}`,
        ),
      ).toBe(0)
      expect(
        await connection.collection<User>("User").findOne({ _id: user._id }),
      ).toEqual(user)
    },
  )

  it.each([
    {},
    { code: "abcdef" },
    { code: "12345" },
    { code: "1234567" },
    { code: 123456 },
    { code: "123456", extra: true },
  ])(
    "отклоняет некорректное тело подтверждения email на уровне DTO: %j",
    async (payload) => {
      const { app } = getTestApplication()
      const { headers } = await createAccount("password")
      const response = await app.inject({
        method: "PATCH",
        url: "/account/email",
        headers,
        payload,
      })

      expect(response.statusCode).toBe(400)
      expect(response.json()).toMatchObject({
        error: { details: { errors: expect.any(Array) } },
      })
    },
  )
})
