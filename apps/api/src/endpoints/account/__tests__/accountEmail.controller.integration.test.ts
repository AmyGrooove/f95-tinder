import { describe, expect, it, jest } from "@jest/globals"

import type { User } from "@entities/user/schemas/user.schema"
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
    expect(await redis.ttl(`${key}:cooldown`)).toBeGreaterThan(0)
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
    {
      method: "POST" as const,
      payload: { email: "invalid", currentPassword: "short" },
    },
    { method: "PATCH" as const, payload: { code: "abcdef" } },
  ])(
    "возвращает 400 для некорректных данных $method /account/email",
    async ({ method, payload }) => {
      const { app, mail } = getTestApplication()
      const { headers } = await createAccount("password")
      const response = await app.inject({
        method,
        url: "/account/email",
        headers,
        payload,
      })

      expect(response.statusCode).toBe(400)
      expect(mail.messages).toHaveLength(0)
    },
  )
})
