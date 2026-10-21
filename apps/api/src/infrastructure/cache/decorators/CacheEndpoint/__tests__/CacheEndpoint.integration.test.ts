import { setTimeout } from "node:timers/promises"
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "@jest/globals"
import { Controller, Get, Post } from "@nestjs/common"
import { FastifyAdapter } from "@nestjs/platform-fastify"
import type { NestFastifyApplication } from "@nestjs/platform-fastify"
import { Test } from "@nestjs/testing"

import { infrastructureConfiguration } from "@infrastructure/config/config.module"
import { InfrastructureConfigService } from "@infrastructure/config/services/config.service"
import { getTestApplication } from "@test/setup/setupIntegration"

import { CacheModule } from "../../../cache.module"
import { CacheService } from "../../../services/cache.service"
import { CacheEndpoint } from "../index"

describe("CacheEndpoint HTTP", () => {
  @Controller("cache-endpoint")
  class TestController {
    calls = 0

    @Get()
    @CacheEndpoint()
    getDefault() {
      return ++this.calls
    }

    @Get("expiring")
    @CacheEndpoint({ ttlMs: 1_000 })
    getExpiring() {
      return ++this.calls
    }

    @Get("persistent")
    @CacheEndpoint({ ttlMs: 0 })
    getPersistent() {
      return ++this.calls
    }

    @Post()
    @CacheEndpoint()
    post() {
      return ++this.calls
    }
  }

  let app: NestFastifyApplication | undefined
  let controller: TestController
  let cache: CacheService

  beforeAll(async () => {
    const configuration = getTestApplication().app.get(
      InfrastructureConfigService,
    )
    const moduleRef = await Test.createTestingModule({
      imports: [CacheModule],
      controllers: [TestController],
    })
      .overrideProvider(infrastructureConfiguration.KEY)
      .useValue({ app: configuration.app, redis: configuration.redis })
      .compile()

    app = moduleRef.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
      { logger: false },
    )
    controller = app.get(TestController)
    cache = app.get(CacheService)
    await app.init()
    await app.getHttpAdapter().getInstance().ready()
  })

  beforeEach(() => {
    controller.calls = 0
  })

  afterAll(async () => {
    await app?.close()
  })

  const request = async (url: string, method: "GET" | "POST" = "GET") => {
    if (app === undefined) {
      throw new Error("Тестовое приложение ещё не запущено")
    }

    const response = await app.inject({ method, url })
    expect(response.statusCode).toBe(method === "GET" ? 200 : 201)

    return response.json<number>()
  }

  const waitForCache = async (key: string, value: number) => {
    for (let attempt = 0; attempt < 100; attempt++) {
      if ((await cache.get<number>(key)) === value) {
        return
      }

      await setTimeout(10)
    }

    throw new Error(`Ответ не появился в кеше: ${key}`)
  }

  const readTtl = async () => {
    const { redis } = getTestApplication()
    const keys = await redis.keys("*")
    expect(keys).toHaveLength(1)

    return redis.pTTL(keys[0] ?? "")
  }

  it("возвращает повторный GET из кеша с TTL по умолчанию 60 секунд", async () => {
    expect(await request("/cache-endpoint")).toBe(1)
    await waitForCache("/cache-endpoint", 1)

    expect(await request("/cache-endpoint")).toBe(1)
    expect(controller.calls).toBe(1)
    const ttl = await readTtl()
    expect(ttl).toBeGreaterThan(50_000)
    expect(ttl).toBeLessThanOrEqual(60_000)
  })

  it("повторно вызывает обработчик после истечения заданного TTL", async () => {
    const url = "/cache-endpoint/expiring"
    expect(await request(url)).toBe(1)
    await waitForCache(url, 1)
    const ttl = await readTtl()
    expect(ttl).toBeGreaterThan(0)
    expect(ttl).toBeLessThanOrEqual(1_000)
    expect(await request(url)).toBe(1)

    await setTimeout(1_100)

    expect(await request(url)).toBe(2)
    await waitForCache(url, 2)
    expect(await request(url)).toBe(2)
    expect(controller.calls).toBe(2)
  })

  it("сохраняет ответ без срока истечения при TTL 0", async () => {
    const url = "/cache-endpoint/persistent"
    expect(await request(url)).toBe(1)
    await waitForCache(url, 1)

    expect(await readTtl()).toBe(-1)
    expect(await request(url)).toBe(1)
    expect(controller.calls).toBe(1)
  })

  it("разделяет кеш для разных query-параметров одного маршрута", async () => {
    const first = "/cache-endpoint?page=1"
    const second = "/cache-endpoint?page=2"
    expect(await request(first)).toBe(1)
    await waitForCache(first, 1)
    expect(await request(second)).toBe(2)
    await waitForCache(second, 2)

    expect(await request(first)).toBe(1)
    expect(await request(second)).toBe(2)
    expect(controller.calls).toBe(2)
  })

  it("не кеширует POST-запросы", async () => {
    expect(await request("/cache-endpoint", "POST")).toBe(1)
    expect(await request("/cache-endpoint", "POST")).toBe(2)

    expect(controller.calls).toBe(2)
    expect(await getTestApplication().redis.dbSize()).toBe(0)
  })
})
