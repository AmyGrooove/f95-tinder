import { describe, expect, it } from "@jest/globals"

import { createTestApplication } from "@test/functions/createTestApplication"
import { getTestApplication } from "@test/setup/setupIntegration"

describe("TestApplication", () => {
  it("изолирует данные, Redis и письма при сбросе и закрытии другого приложения", async () => {
    const first = getTestApplication()
    const second = await createTestApplication()
    const message = {
      to: "user@example.test",
      subject: "Изоляция",
      text: "Тестовое письмо",
    }

    try {
      await first.connection
        .collection("test_isolation")
        .insertOne({ value: "first" })
      await second.connection
        .collection("test_isolation")
        .insertOne({ value: "second" })
      await first.redis.set("test:isolation", "first")
      await second.redis.set("test:isolation", "second")
      await first.mail.send(message)
      await second.mail.send(message)

      expect(first.connection.name).not.toBe(second.connection.name)
      expect(await first.redis.get("test:isolation")).toBe("first")
      expect(await second.redis.get("test:isolation")).toBe("second")

      await second.reset()

      expect(
        await second.connection.collection("test_isolation").countDocuments(),
      ).toBe(0)
      expect(await second.redis.get("test:isolation")).toBeNull()
      expect(second.mail.messages).toStrictEqual([])

      await second.close()
      await expect(second.close()).resolves.toBeUndefined()

      expect(
        await first.connection
          .collection("test_isolation")
          .findOne({}, { projection: { _id: 0 } }),
      ).toStrictEqual({ value: "first" })
      expect(await first.redis.get("test:isolation")).toBe("first")
      expect(first.mail.messages).toStrictEqual([message])
    } finally {
      await second.close()
    }
  }, 300_000)

  it("запускается без импорта словаря тегов и автоматических коллекций", async () => {
    const environment = await createTestApplication()

    try {
      expect(
        await environment.connection.collection("Tag").countDocuments(),
      ).toBe(0)
      expect(
        await environment.connection.collection("Collection").countDocuments(),
      ).toBe(0)
    } finally {
      await environment.close()
    }
  })

  it("сохраняет ошибку Redis и закрывает все соединения перед её возвратом", async () => {
    const environment = await createTestApplication()
    const error = new Error("Тестовый сбой Redis")

    try {
      expect(() => environment.redis.emit("error", error)).not.toThrow()
      await expect(environment.reset()).rejects.toMatchObject({
        errors: expect.arrayContaining([error]),
      })
    } finally {
      await expect(environment.close()).rejects.toMatchObject({
        errors: expect.arrayContaining([error]),
      })
    }

    expect(environment.redis.isOpen).toBe(false)
    expect(environment.connection.readyState).toBe(0)
  }, 300_000)

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

    await expect(reset()).resolves.toBeUndefined()
  })

  it("откатывает изменения MongoDB при ошибке транзакции", async () => {
    const { connection } = getTestApplication()
    const collection = connection.collection("test_rollback")
    await collection.insertOne({ value: "initial" })
    const session = await connection.startSession()
    const error = new Error("Откат транзакции")

    try {
      await expect(
        session.withTransaction(async () => {
          await collection.insertOne({ value: "rolled-back" }, { session })
          throw error
        }),
      ).rejects.toBe(error)
    } finally {
      await session.endSession()
    }

    expect(
      await collection.find({}, { projection: { _id: 0 } }).toArray(),
    ).toStrictEqual([{ value: "initial" }])
  })
})
