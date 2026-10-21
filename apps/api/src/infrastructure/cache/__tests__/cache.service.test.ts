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
import { Test } from "@nestjs/testing"
import type { TestingModule } from "@nestjs/testing"
import type { Cache } from "cache-manager"

import { CacheService } from "../services/cache.service"

describe("CacheService", () => {
  const cache = {
    get: jest.fn<Cache["get"]>(),
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
      cache.get.mockResolvedValue(value)

      await expect(service.get("key")).resolves.toBe(value)
      expect(cache.get).toHaveBeenCalledWith("key")
    },
  )

  it.each([undefined, null])("возвращает null вместо %p", async (value) => {
    cache.get.mockResolvedValue(value)

    await expect(service.get("missing")).resolves.toBeNull()
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
    cache.get.mockRejectedValue(error)

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
