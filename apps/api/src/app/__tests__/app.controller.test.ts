import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals"
import { ServiceUnavailableException } from "@nestjs/common"
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from "@nestjs/platform-fastify"
import { Test } from "@nestjs/testing"
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger"

import { HealthService } from "@infrastructure/health/services/health.service"

import { AppController } from "../controllers/app.controller"
import { BACKGROUNDS } from "../static/BACKGROUNDS"

describe("AppController", () => {
  const health = { checkHealth: jest.fn<HealthService["checkHealth"]>() }
  let app: NestFastifyApplication

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AppController],
      providers: [{ provide: HealthService, useValue: health }],
    }).compile()
    app = moduleRef.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
      { logger: false },
    )
    await app.init()
    await app.getHttpAdapter().getInstance().ready()
  })

  beforeEach(() => {
    health.checkHealth.mockReset()
    health.checkHealth.mockResolvedValue({
      status: "ok",
      error: {},
      details: { database: { status: "up" }, cache: { status: "up" } },
    })
  })

  afterAll(async () => {
    await app?.close()
  })

  it("возвращает HTML со статусами сервисов, ссылками и новым запросом фона без кеширования", async () => {
    const first = await app.inject({ method: "GET", url: "/" })
    const second = await app.inject({ method: "GET", url: "/" })
    expect(first.statusCode).toBe(200)
    expect(first.headers["content-type"]).toBe("text/html; charset=utf-8")
    expect(first.headers["cache-control"]).toBe("no-store")
    expect(first.body).toContain('href="/docs"')
    expect(first.body).toContain('href="https://bisky.one/"')
    expect(first.body).toContain('class="service is-up"')
    expect(first.body).toContain("Работает")
    expect(first.body).toContain("database")
    expect(first.body).toContain("cache")
    expect(first.body).not.toContain("{{")
    const firstBackground = first.body.match(
      /src="(\/background\?request=[^"]+)"/,
    )?.[1]
    const secondBackground = second.body.match(
      /src="(\/background\?request=[^"]+)"/,
    )?.[1]
    expect(firstBackground).toBeDefined()
    expect(secondBackground).toBeDefined()
    expect(firstBackground).not.toBe(secondBackground)
  })

  it("показывает недоступный сервис из ошибки health с сохранением HTTP 200 страницы", async () => {
    health.checkHealth.mockRejectedValue(
      new ServiceUnavailableException({
        status: "error",
        details: { database: { status: "up" }, cache: { status: "down" } },
      }),
    )
    const response = await app.inject({ method: "GET", url: "/" })
    expect(response.statusCode).toBe(200)
    expect(response.body).toContain('class="service is-up"')
    expect(response.body).toContain('class="service is-down"')
    expect(response.body).toContain("Недоступен")
    expect(response.body).not.toContain("{{")
  })

  it("не скрывает неожиданную ошибку проверки здоровья", async () => {
    health.checkHealth.mockRejectedValue(new Error("Health failure"))
    const response = await app.inject({ method: "GET", url: "/" })
    expect(response.statusCode).toBe(500)
  })

  it("исключает служебную страницу и фон из Swagger", () => {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().build(),
    )
    expect(document.paths).not.toHaveProperty("/")
    expect(document.paths).not.toHaveProperty("/background")
  })

  it.each([
    undefined,
    "other=value",
    "biskyBackground=99999",
    "biskyBackground=bad",
  ])("выдаёт изображение и cookie при предыдущем фоне %s", async (cookie) => {
    const bytes = Buffer.from([0, 1, 255, 10])
    const fetch = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(bytes, { headers: { "content-type": "image/png" } }),
      )
    const response = await app.inject({
      method: "GET",
      url: "/background",
      headers: cookie === undefined ? {} : { cookie },
    })
    expect(response.statusCode).toBe(200)
    expect(response.rawPayload).toEqual(bytes)
    expect(response.headers["content-type"]).toBe("image/png")
    expect(response.headers["cache-control"]).toBe("no-store")
    const selected = fetch.mock.calls[0]?.[0]
    expect(BACKGROUNDS).toContain(selected)
    expect(response.headers["set-cookie"]).toBe(
      `biskyBackground=${BACKGROUNDS.findIndex((background) => background === selected)}; Path=/background; HttpOnly; SameSite=Lax`,
    )
    expect(health.checkHealth).not.toHaveBeenCalled()
  })

  it.each(["biskyBackground=0", "other=value; biskyBackground=0; tail=value"])(
    "не повторяет предыдущий фон из cookie %s",
    async (cookie) => {
      jest.spyOn(Math, "random").mockReturnValue(0)
      const fetch = jest
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(
          new Response("image", { headers: { "content-type": "image/webp" } }),
        )
      const response = await app.inject({
        method: "GET",
        url: "/background",
        headers: { cookie },
      })
      expect(response.statusCode).toBe(200)
      expect(fetch).toHaveBeenCalledWith(BACKGROUNDS[1])
      expect(response.headers["set-cookie"]).toContain("biskyBackground=1;")
    },
  )

  it.each([
    { status: 404, contentType: "image/png" },
    { status: 200, contentType: "text/html" },
    { status: 200, contentType: undefined },
  ])(
    "возвращает 502 без cookie для неподходящего ответа источника $status/$contentType",
    async ({ status, contentType }) => {
      jest.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response("upstream", {
          status,
          headers:
            contentType === undefined ? {} : { "content-type": contentType },
        }),
      )
      const response = await app.inject({ method: "GET", url: "/background" })
      expect(response.statusCode).toBe(502)
      expect(response.headers["set-cookie"]).toBeUndefined()
    },
  )

  it("возвращает ошибку без cookie при сетевом сбое источника", async () => {
    jest
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("Network failure"))
    const response = await app.inject({ method: "GET", url: "/background" })
    expect(response.statusCode).toBe(500)
    expect(response.headers["set-cookie"]).toBeUndefined()
  })
})
