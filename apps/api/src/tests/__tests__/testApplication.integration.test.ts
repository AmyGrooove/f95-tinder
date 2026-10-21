import { describe, expect, it } from "@jest/globals"

import { getTestApplication } from "@test/setup/setupIntegration"
import { createTestApplication } from "@test/functions/createTestApplication"

describe("TestApplication", () => {
  it("сохраняет ошибку Redis и закрывает все соединения перед её возвратом", async () => {
    const environment = await createTestApplication()
    const error = new Error("Тестовый сбой Redis")

    try {
      expect(() => environment.redis.emit("error", error)).not.toThrow()
    } finally {
      await expect(environment.close()).rejects.toMatchObject({
        errors: expect.arrayContaining([error]),
      })
    }

    expect(environment.redis.isOpen).toBe(false)
    expect(environment.connection.readyState).toBe(0)
  })

  it("поддерживает транзакции MongoDB и очищает данные, Redis и письма", async () => {
    const { app, connection, redis, mail, reset } = getTestApplication()
    const collection = connection.collection("test_setup")
    const session = await connection.startSession()

    try {
      await session.withTransaction(async () => {
        await collection.insertOne({ value: "test" }, { session })
      })
    } finally {
      await session.endSession()
    }

    await redis.set("test:setup", "value")
    await mail.send({
      to: "user@example.test",
      subject: "Проверка",
      text: "Тестовое письмо",
    })

    expect(await collection.countDocuments()).toBe(1)
    expect(await redis.get("test:setup")).toBe("value")
    expect(mail.messages).toHaveLength(1)
    expect(app.getHttpAdapter().getInstance().server.listening).toBe(false)

    await reset()

    expect(await collection.countDocuments()).toBe(0)
    expect(await redis.get("test:setup")).toBeNull()
    expect(mail.messages).toHaveLength(0)
  })
})
