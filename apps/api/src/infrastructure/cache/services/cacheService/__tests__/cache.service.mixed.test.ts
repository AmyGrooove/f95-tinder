import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals"
import { CACHE_MANAGER } from "@nestjs/cache-manager"
import { Test, type TestingModule } from "@nestjs/testing"
import type { Cache } from "cache-manager"
import { CacheService } from "../core/cache.service"
import { setTimeout } from "node:timers/promises"
import { infrastructureConfiguration } from "@infrastructure/config/config.module"
import { CacheModule } from "../../../cache.module"

if (Reflect.get(globalThis, "IS_INTEGRATION_TEST") === true) {
  const { getTestRedis } = await import("../../../__tests__/setup/setupRedis")

  describe("CacheService", () => {
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

      it.each([
        "value",
        { nested: [1, "value"], isEnabled: true },
        0,
        false,
        "",
      ])(
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
} else {
  describe("CacheService", () => {
    const cache = {
      stores: [
        { get: jest.fn<Cache["stores"][number]["get"]>() },
        { get: jest.fn<Cache["stores"][number]["get"]>() },
      ],
      set: jest.fn<Cache["set"]>(),
      del: jest.fn<Cache["del"]>(),
    }
    let moduleRef: TestingModule
    let service: CacheService

    beforeAll(async () => {
      moduleRef = await Test.createTestingModule({
        providers: [CacheService, { provide: CACHE_MANAGER, useValue: cache }],
      }).compile()
      service = moduleRef.get(CacheService)
    })

    beforeEach(() => {
      jest.resetAllMocks()
    })

    afterAll(async () => {
      await moduleRef?.close()
    })

    it.each(["value", { nested: [1, "value"] }, 0, false, ""])(
      "возвращает сохранённое значение %p без изменений",
      async (value) => {
        cache.stores[0].get.mockResolvedValue(value)

        await expect(service.get("key")).resolves.toBe(value)
        expect(cache.stores[0].get).toHaveBeenCalledWith("key")
      },
    )

    it.each([undefined, null])("возвращает null вместо %p", async (value) => {
      cache.stores[0].get.mockResolvedValue(value)

      await expect(service.get("missing")).resolves.toBeNull()
    })

    it("при промахе первого хранилища не читает из второго", async () => {
      cache.stores[0].get.mockResolvedValue(undefined)
      cache.stores[1].get.mockResolvedValue("stale")

      await expect(service.get("missing")).resolves.toBeNull()
      expect(cache.stores[1].get).not.toHaveBeenCalled()
    })

    it.each([undefined, 10_000, 0])(
      "передаёт значение и TTL %p при записи",
      async (ttl) => {
        const value = { nested: [1, 2] }

        await expect(service.set("key", value, ttl)).resolves.toBeUndefined()
        expect(cache.set).toHaveBeenCalledWith("key", value, ttl)
      },
    )

    it("передаёт ключ при удалении и не возвращает результат адаптера", async () => {
      cache.del.mockResolvedValue(true)

      await expect(service.delete("key")).resolves.toBeUndefined()
      expect(cache.del).toHaveBeenCalledWith("key")
    })

    it("передаёт ошибку чтения вызывающему коду", async () => {
      const error = new Error("read failed")
      cache.stores[0].get.mockRejectedValue(error)

      await expect(service.get("key")).rejects.toBe(error)
    })

    it("передаёт ошибку записи вызывающему коду", async () => {
      const error = new Error("write failed")
      cache.set.mockRejectedValue(error)

      await expect(service.set("key", "value")).rejects.toBe(error)
    })

    it("передаёт ошибку удаления вызывающему коду", async () => {
      const error = new Error("delete failed")
      cache.del.mockRejectedValue(error)

      await expect(service.delete("key")).rejects.toBe(error)
    })
  })
}
