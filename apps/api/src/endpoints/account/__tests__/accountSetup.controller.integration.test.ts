import { describe, expect, it, jest } from "@jest/globals"

import type { User } from "@entities/user/schemas/user.schema"
import { compareHash } from "@infrastructure/security/functions/compareHash"
import { getTestApplication } from "@test/setup/setupIntegration"

import { createAccount } from "./functions/createAccount"
import { readConfirmationCode } from "./functions/readConfirmationCode"

describe("AccountSetupController HTTP", () => {
  it("отправляет письмо, сохраняет заявку в Redis и завершает настройку только после подтверждения", async () => {
    const { app, connection, redis, mail } = getTestApplication()
    const { user, headers, accessCode, password } = await createAccount()
    const key = `bisky-test:account:setup:{${user._id.toHexString()}}`
    const requested = await app.inject({
      method: "POST",
      url: "/account/setup",
      headers,
      payload: { email: "  SETUP@EXAMPLE.COM  ", password, accessCode },
    })

    expect(requested.statusCode).toBe(204)
    expect(requested.body).toBe("")
    expect(requested.headers["cache-control"]).toBe("no-store")
    expect(mail.messages).toHaveLength(1)
    expect(mail.messages[0]).toMatchObject({ to: "setup@example.com" })
    expect(await redis.ttl(key)).toBeGreaterThan(0)
    expect(await redis.ttl(key)).toBeLessThanOrEqual(4 * 60 * 60)
    expect(await redis.ttl(`${key}:cooldown`)).toBeGreaterThan(0)
    expect(await redis.ttl(`${key}:cooldown`)).toBeLessThanOrEqual(60)
    expect(
      await connection.collection<User>("User").findOne({ _id: user._id }),
    ).toMatchObject({
      email: null,
      passwordHash: null,
      accessCodeHash: user.accessCodeHash,
    })
    const code = readConfirmationCode()
    const confirmed = await app.inject({
      method: "PATCH",
      url: "/account/setup",
      headers,
      payload: { code },
    })

    expect(confirmed.statusCode).toBe(204)
    expect(confirmed.body).toBe("")
    expect(confirmed.headers["cache-control"]).toBe("no-store")
    expect(await redis.exists(key)).toBe(0)
    const updated = await connection
      .collection<User>("User")
      .findOne({ _id: user._id })
    expect(updated).toMatchObject({
      email: "setup@example.com",
      accessCodeHash: null,
    })
    expect(await compareHash(password, updated?.passwordHash ?? "")).toBe(true)
    const login = await app.inject({
      method: "POST",
      url: "/auth/login",
      headers,
      payload: { username: user.username, password },
    })
    expect(login.statusCode).toBe(204)
    const oldCode = await app.inject({
      method: "POST",
      url: "/auth/login/code",
      headers,
      payload: { accessCode },
    })
    expect(oldCode.statusCode).toBe(401)
    const repeated = await app.inject({
      method: "PATCH",
      url: "/account/setup",
      headers,
      payload: { code },
    })
    expect(repeated.statusCode).toBe(409)
  })

  it("не меняет аккаунт при неверном коде и разрешает подтверждение верным кодом", async () => {
    const { app, connection } = getTestApplication()
    const { user, headers, accessCode, password } = await createAccount()
    const requested = await app.inject({
      method: "POST",
      url: "/account/setup",
      headers,
      payload: { email: "setup@example.com", password, accessCode },
    })
    expect(requested.statusCode).toBe(204)
    const code = readConfirmationCode()
    const wrongCode = code === "000000" ? "000001" : "000000"
    const rejected = await app.inject({
      method: "PATCH",
      url: "/account/setup",
      headers,
      payload: { code: wrongCode },
    })

    expect(rejected.statusCode).toBe(400)
    expect(
      await connection.collection<User>("User").findOne({ _id: user._id }),
    ).toMatchObject({ email: null, passwordHash: null })
    const confirmed = await app.inject({
      method: "PATCH",
      url: "/account/setup",
      headers,
      payload: { code },
    })
    expect(confirmed.statusCode).toBe(204)
  })

  it("после трёх неверных кодов удаляет заявку и отклоняет даже верный код", async () => {
    const { app, redis } = getTestApplication()
    const { user, headers, accessCode, password } = await createAccount()
    const requested = await app.inject({
      method: "POST",
      url: "/account/setup",
      headers,
      payload: { email: "setup@example.com", password, accessCode },
    })
    expect(requested.statusCode).toBe(204)
    const code = readConfirmationCode()

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await app.inject({
        method: "PATCH",
        url: "/account/setup",
        headers,
        payload: { code: code === "000000" ? "000001" : "000000" },
      })
      expect(response.statusCode).toBe(400)
    }

    expect(
      await redis.exists(
        `bisky-test:account:setup:{${user._id.toHexString()}}`,
      ),
    ).toBe(0)
    const response = await app.inject({
      method: "PATCH",
      url: "/account/setup",
      headers,
      payload: { code },
    })
    expect(response.statusCode).toBe(400)
  })

  it("ограничивает повторную отправку через Redis и не отправляет второе письмо", async () => {
    const { app, mail } = getTestApplication()
    const { headers, accessCode, password } = await createAccount()
    const request = {
      method: "POST" as const,
      url: "/account/setup",
      headers,
      payload: { email: "setup@example.com", password, accessCode },
    }

    expect((await app.inject(request)).statusCode).toBe(204)
    expect((await app.inject(request)).statusCode).toBe(429)
    expect(mail.messages).toHaveLength(1)
  })

  it.each(["email-taken", "access-code-changed"])(
    "отклоняет подтверждение настройки после изменения данных: %s",
    async (scenario) => {
      const { app, connection, redis } = getTestApplication()
      const { user, headers, accessCode, password } = await createAccount()
      const users = connection.collection<User>("User")
      const requested = await app.inject({
        method: "POST",
        url: "/account/setup",
        headers,
        payload: { email: "setup@example.com", password, accessCode },
      })
      expect(requested.statusCode).toBe(204)
      const code = readConfirmationCode()

      if (scenario === "email-taken") {
        const other = await createAccount("password")
        await users.updateOne(
          { _id: other.user._id },
          { $set: { email: "setup@example.com" } },
        )
      } else {
        const reissued = await app.inject({
          method: "PATCH",
          url: "/auth/login/code",
          headers,
          payload: { accessCode },
        })
        expect(reissued.statusCode).toBe(200)
        expect(reissued.json<{ accessCode: string }>().accessCode).not.toBe(
          accessCode,
        )
      }

      const before = await users.find({}).toArray()
      const response = await app.inject({
        method: "PATCH",
        url: "/account/setup",
        headers,
        payload: { code },
      })

      expect(response.statusCode).toBe(scenario === "email-taken" ? 409 : 400)
      expect(response.cookies).toEqual([])
      expect(await users.find({}).toArray()).toEqual(before)
      expect(
        await redis.exists(
          `bisky-test:account:setup:{${user._id.toHexString()}}`,
        ),
      ).toBe(0)
    },
  )

  it("не настраивает аккаунт по истёкшей заявке", async () => {
    const { app, connection, redis } = getTestApplication()
    const { user, headers, accessCode, password } = await createAccount()
    const requested = await app.inject({
      method: "POST",
      url: "/account/setup",
      headers,
      payload: { email: "setup@example.com", password, accessCode },
    })
    expect(requested.statusCode).toBe(204)
    const code = readConfirmationCode()
    const key = `bisky-test:account:setup:{${user._id.toHexString()}}`
    await redis.expire(key, 0)
    expect(await redis.exists(key)).toBe(0)
    const response = await app.inject({
      method: "PATCH",
      url: "/account/setup",
      headers,
      payload: { code },
    })

    expect(response.statusCode).toBe(400)
    expect(response.cookies).toEqual([])
    expect(
      await connection.collection<User>("User").findOne({ _id: user._id }),
    ).toEqual(user)
  })

  it("при сбое почты возвращает 503, удаляет заявку и позволяет повторную отправку", async () => {
    const { app, redis, mail } = getTestApplication()
    const { user, headers, accessCode, password } = await createAccount()
    jest
      .spyOn(mail, "send")
      .mockRejectedValueOnce(new Error("Тестовый сбой почты"))
    const request = {
      method: "POST" as const,
      url: "/account/setup",
      headers,
      payload: { email: "setup@example.com", password, accessCode },
    }
    const response = await app.inject(request)

    expect(response.statusCode).toBe(503)
    expect(mail.messages).toHaveLength(0)
    const key = `bisky-test:account:setup:{${user._id.toHexString()}}`
    expect(await redis.exists([key, `${key}:cooldown`])).toBe(0)
    expect((await app.inject(request)).statusCode).toBe(204)
    expect(mail.messages).toHaveLength(1)
  })

  it("отклоняет неверный код доступа без письма и заявки в Redis", async () => {
    const { app, redis, mail } = getTestApplication()
    const { user, headers, accessCode, password } = await createAccount()
    const wrongCode = `${accessCode[0] === "a" ? "b" : "a"}${accessCode.slice(1)}`
    const response = await app.inject({
      method: "POST",
      url: "/account/setup",
      headers,
      payload: { email: "setup@example.com", password, accessCode: wrongCode },
    })

    expect(response.statusCode).toBe(401)
    expect(mail.messages).toHaveLength(0)
    expect(
      await redis.exists(
        `bisky-test:account:setup:{${user._id.toHexString()}}`,
      ),
    ).toBe(0)
  })

  it("возвращает 409 для уже настроенного аккаунта", async () => {
    const { app, mail } = getTestApplication()
    const { headers, accessCode, password } = await createAccount("password")
    const response = await app.inject({
      method: "POST",
      url: "/account/setup",
      headers,
      payload: { email: "setup@example.com", password, accessCode },
    })

    expect(response.statusCode).toBe(409)
    expect(mail.messages).toHaveLength(0)
  })

  it("возвращает 409 для занятого email без отправки письма", async () => {
    const { app, mail } = getTestApplication()
    const existing = await createAccount("password")
    const { headers, accessCode, password } = await createAccount()
    const response = await app.inject({
      method: "POST",
      url: "/account/setup",
      headers,
      payload: { email: existing.user.email, password, accessCode },
    })

    expect(response.statusCode).toBe(409)
    expect(mail.messages).toHaveLength(0)
  })

  it.each(["POST", "PATCH"] as const)(
    "возвращает 401 без cookies для %s /account/setup",
    async (method) => {
      const response = await getTestApplication().app.inject({
        method,
        url: "/account/setup",
        headers: { origin: "http://localhost" },
        payload:
          method === "POST"
            ? {
                email: "setup@example.com",
                password: "password123",
                accessCode: "a".repeat(32),
              }
            : { code: "123456" },
      })

      expect(response.statusCode).toBe(401)
    },
  )

  it.each([
    { email: "invalid" },
    { email: 123 },
    { email: null },
    { password: "short" },
    { password: "я".repeat(37) },
    { password: 123 },
    { password: null },
    { accessCode: "A".repeat(31) },
    { accessCode: "A".repeat(33) },
    { accessCode: "!".repeat(32) },
    { accessCode: 123 },
    { accessCode: null },
    { extra: true },
  ])(
    "отклоняет отдельное некорректное поле запроса настройки: %j",
    async (invalidField) => {
      const { app, mail, connection, redis } = getTestApplication()
      const { user, headers, accessCode, password } = await createAccount()
      const response = await app.inject({
        method: "POST",
        url: "/account/setup",
        headers,
        payload: {
          email: "setup@example.com",
          password,
          accessCode,
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
          `bisky-test:account:setup:{${user._id.toHexString()}}`,
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
    "отклоняет некорректное тело подтверждения настройки на уровне DTO: %j",
    async (payload) => {
      const { app } = getTestApplication()
      const { headers } = await createAccount()
      const response = await app.inject({
        method: "PATCH",
        url: "/account/setup",
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
