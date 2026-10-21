import { describe, expect, it, jest } from "@jest/globals"
import type { Connection } from "mongoose"

import { DICTIONARY } from "@shared/static/DICTIONARY"

import { MongoHealthService } from "../services/mongoHealth.service"

describe("MongoHealthService", () => {
  it.each([undefined, null])(
    "отклоняет проверку при отсутствии db: %p",
    async (db) => {
      const service = new MongoHealthService({ db } as unknown as Connection)

      await expect(service.healthCheck()).rejects.toThrow(
        DICTIONARY.database.unavailable,
      )
    },
  )

  it("возвращает true после успешного ping", async () => {
    const ping = jest.fn<() => Promise<unknown>>().mockResolvedValue({ ok: 1 })
    const service = new MongoHealthService({
      db: { admin: () => ({ ping }) },
    } as unknown as Connection)

    await expect(service.healthCheck()).resolves.toBe(true)
    expect(ping).toHaveBeenCalledTimes(1)
  })

  it("передаёт ошибку ping вызывающему коду", async () => {
    const error = new Error("ping failed")
    const service = new MongoHealthService({
      db: {
        admin: () => ({
          ping: async () => {
            throw error
          },
        }),
      },
    } as unknown as Connection)

    await expect(service.healthCheck()).rejects.toBe(error)
  })

  it("проверяет соединение при bootstrap и передаёт ошибку", async () => {
    const service = new MongoHealthService({} as Connection)
    const healthCheck = jest
      .spyOn(service, "healthCheck")
      .mockResolvedValue(true)

    await expect(service.onApplicationBootstrap()).resolves.toBeUndefined()
    expect(healthCheck).toHaveBeenCalledTimes(1)
    const error = new Error("bootstrap failed")
    healthCheck.mockRejectedValue(error)
    await expect(service.onApplicationBootstrap()).rejects.toBe(error)
  })
})
