import { setTimeout } from "node:timers/promises"
import { afterAll, beforeAll, describe, expect, it } from "@jest/globals"
import { Test } from "@nestjs/testing"
import type { TestingModule } from "@nestjs/testing"

import { infrastructureConfiguration } from "@infrastructure/config/config.module"
import { getTestRedis } from "../../../__tests__/setup/setupRedis"

import { CacheModule } from "../../../cache.module"
import { CacheService } from "../core/cache.service"

describe("CacheService Redis", () => {
  let moduleRef: TestingModule | undefined
  let service: CacheService

  beforeAll(async () => {
    const { configuration } = getTestRedis()
    moduleRef = await Test.createTestingModule({ imports: [CacheModule] })
      .overrideProvider(infrastructureConfiguration.KEY)
      .useValue({ app: configuration.app, redis: configuration.redis })
      .compile()
    service = moduleRef.get(CacheService)
    await moduleRef.init()
  })

  afterAll(async () => {
    await moduleRef?.close()
  })

  describe("CacheService", () => {
    it("возвращает null для отсутствующего ключа", async () => {
      await expect(service.get("missing")).resolves.toBeNull()
    })

    it.each(["value", { nested: [1, "value"], isEnabled: true }, 0, false, ""])(
      "сохраняет и восстанавливает значение %p через Redis",
      async (value) => {
        await service.set("round-trip", value)

        await expect(service.get("round-trip")).resolves.toStrictEqual(value)
        expect(await getTestRedis().redis.dbSize()).toBe(1)
      },
    )

    it("заменяет значение существующего ключа", async () => {
      await service.set("overwrite", "old")
      await service.set("overwrite", "new")

      await expect(service.get("overwrite")).resolves.toBe("new")
    })

    it("удаляет значение из Redis", async () => {
      await service.set("delete", "value")

      await expect(service.delete("delete")).resolves.toBeUndefined()
      await expect(service.get("delete")).resolves.toBeNull()
      expect(await getTestRedis().redis.dbSize()).toBe(0)
    })

    it("позволяет удалить отсутствующий ключ", async () => {
      await expect(service.delete("missing")).resolves.toBeUndefined()
    })

    it("задаёт TTL в миллисекундах и возвращает null после истечения", async () => {
      const { redis } = getTestRedis()
      await service.set("expires", "value", 1_000)
      await expect(service.get("expires")).resolves.toBe("value")
      const keys = await redis.keys("*")
      expect(keys).toHaveLength(1)
      const ttl = await redis.pTTL(keys[0] ?? "")
      expect(ttl).toBeGreaterThan(0)
      expect(ttl).toBeLessThanOrEqual(1_000)

      await setTimeout(1_100)

      await expect(service.get("expires")).resolves.toBeNull()
      expect(await redis.dbSize()).toBe(0)
    })

    it("хранит значение без срока истечения при TTL 0", async () => {
      const { redis } = getTestRedis()
      await service.set("persistent", "value", 0)
      const keys = await redis.keys("*")

      expect(keys).toHaveLength(1)
      expect(await redis.pTTL(keys[0] ?? "")).toBe(-1)
      await expect(service.get("persistent")).resolves.toBe("value")
    })
  })
})
