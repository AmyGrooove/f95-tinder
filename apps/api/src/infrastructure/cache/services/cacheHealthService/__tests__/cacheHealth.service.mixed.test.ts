import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals"
import { Test, type TestingModule } from "@nestjs/testing"
import { DICTIONARY } from "@shared/static/DICTIONARY"
import { CacheService } from "@infrastructure/cache/services/cacheService"
import { CacheHealthService } from "../core/cacheHealth.service"
import { infrastructureConfiguration } from "@infrastructure/config/config.module"
import { CacheModule } from "../../../cache.module"

if (Reflect.get(globalThis, "IS_INTEGRATION_TEST") === true) {
  const { getTestRedis } = await import("../../../__tests__/setup/setupRedis")

  describe("CacheHealthService", () => {
    let moduleRef: TestingModule | undefined
    let service: CacheService
    let health: CacheHealthService

    beforeAll(async () => {
      const { configuration } = getTestRedis()
      moduleRef = await Test.createTestingModule({ imports: [CacheModule] })
        .overrideProvider(infrastructureConfiguration.KEY)
        .useValue({ app: configuration.app, redis: configuration.redis })
        .compile()
      service = moduleRef.get(CacheService)
      health = moduleRef.get(CacheHealthService)
      await moduleRef.init()
    })

    afterAll(async () => {
      await moduleRef?.close()
    })

    describe("CacheHealthService", () => {
      it("успешно проверяет Redis и удаляет временный ключ", async () => {
        await expect(health.healthCheck()).resolves.toBe(true)

        expect(await getTestRedis().redis.dbSize()).toBe(0)
      })

      it("сохраняет существующие значения при проверке Redis", async () => {
        await service.set("existing", { value: 42 })

        await expect(health.healthCheck()).resolves.toBe(true)
        await expect(service.get("existing")).resolves.toStrictEqual({
          value: 42,
        })
        expect(await getTestRedis().redis.dbSize()).toBe(1)
      })

      it("проверяет Redis при инициализации Nest-модуля и удаляет временный ключ", async () => {
        const { configuration, redis } = getTestRedis()
        const startupModule = await Test.createTestingModule({
          imports: [CacheModule],
        })
          .overrideProvider(infrastructureConfiguration.KEY)
          .useValue({ app: configuration.app, redis: configuration.redis })
          .compile()

        try {
          const healthCheck = jest.spyOn(
            startupModule.get(CacheHealthService),
            "healthCheck",
          )

          await expect(startupModule.init()).resolves.toBe(startupModule)
          expect(healthCheck).toHaveBeenCalledTimes(1)
          expect(await redis.dbSize()).toBe(0)
        } finally {
          await startupModule.close()
        }
      })
    })
  })
} else {
  describe("CacheHealthService", () => {
    const set = jest.fn<CacheService["set"]>()
    const get = jest.fn<(key: string) => Promise<unknown>>()
    const remove = jest.fn<CacheService["delete"]>()
    let moduleRef: TestingModule
    let service: CacheHealthService

    beforeAll(async () => {
      moduleRef = await Test.createTestingModule({
        providers: [
          CacheHealthService,
          { provide: CacheService, useValue: { set, get, delete: remove } },
        ],
      }).compile()
      service = moduleRef.get(CacheHealthService)
    })

    beforeEach(() => {
      set.mockReset().mockResolvedValue(undefined)
      get.mockReset().mockImplementation(async () => set.mock.calls[0][1])
      remove.mockReset().mockResolvedValue(undefined)
    })

    afterAll(async () => {
      await moduleRef?.close()
    })

    it("проверяет записанное значение и удаляет тот же временный ключ", async () => {
      await expect(service.healthCheck()).resolves.toBe(true)

      expect(set).toHaveBeenCalledTimes(1)
      expect(set).toHaveBeenCalledWith(
        expect.stringMatching(/^health-check:/),
        expect.any(String),
        10_000,
      )
      const [key] = set.mock.calls[0]
      expect(get).toHaveBeenCalledWith(key)
      expect(remove).toHaveBeenCalledWith(key)
      expect(remove).toHaveBeenCalledTimes(1)
    })

    it.each([null, "wrong-value"])(
      "отклоняет несовпадающее значение %p и очищает временный ключ",
      async (value) => {
        get.mockResolvedValueOnce(value)

        await expect(service.healthCheck()).rejects.toThrow(
          DICTIONARY.cache.unexpectedHealthValue,
        )
        expect(remove).toHaveBeenCalledWith(set.mock.calls[0][0])
      },
    )

    it.each(["set", "get"])(
      "очищает временный ключ при ошибке %s и сохраняет исходную ошибку",
      async (operation) => {
        const error = new Error("Redis unavailable")
        if (operation === "set") {
          set.mockRejectedValueOnce(error)
        } else {
          get.mockRejectedValueOnce(error)
        }

        await expect(service.healthCheck()).rejects.toBe(error)
        expect(remove).toHaveBeenCalledWith(set.mock.calls[0][0])
        expect(get).toHaveBeenCalledTimes(operation === "get" ? 1 : 0)
      },
    )

    it("не скрывает ошибку очистки после успешной проверки", async () => {
      const error = new Error("Cleanup failed")
      remove.mockRejectedValueOnce(error)

      await expect(service.healthCheck()).rejects.toBe(error)
    })

    it.each([new Error("Read failed"), undefined])(
      "сохраняет обе причины при ошибке проверки %p и очистки",
      async (healthError) => {
        const cleanupError = new Error("Cleanup failed")
        get.mockRejectedValueOnce(healthError)
        remove.mockRejectedValueOnce(cleanupError)

        await expect(service.healthCheck()).rejects.toMatchObject({
          name: "AggregateError",
          message: DICTIONARY.cache.healthAndCleanupFailed,
          errors: [healthError, cleanupError],
          cause: cleanupError,
        })
      },
    )

    it("не превращает выброшенный undefined в успешную проверку", async () => {
      get.mockRejectedValueOnce(undefined)

      await expect(service.healthCheck()).rejects.toBeUndefined()
      expect(remove).toHaveBeenCalledTimes(1)
    })
  })
}
