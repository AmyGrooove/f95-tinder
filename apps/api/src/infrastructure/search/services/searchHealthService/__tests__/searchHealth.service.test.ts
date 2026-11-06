import { describe, expect, it, jest } from "@jest/globals"
import type { Meilisearch } from "meilisearch"

import { DICTIONARY } from "@shared/static/DICTIONARY"
import { SearchHealthService } from "../core/searchHealth.service"

describe("SearchHealthService", () => {
  it("считает поисковик доступным и допускает запуск приложения", async () => {
    const health = jest.fn(async () => ({ status: "available" }))
    const service = new SearchHealthService({
      health,
    } as unknown as Meilisearch)

    await expect(service.healthCheck()).resolves.toBe(true)
    await expect(service.onApplicationBootstrap()).resolves.toBeUndefined()
  })

  it("считает поисковик недоступным при другом статусе и прерывает запуск", async () => {
    const health = jest.fn(async () => ({ status: "unavailable" }))
    const service = new SearchHealthService({
      health,
    } as unknown as Meilisearch)

    await expect(service.healthCheck()).resolves.toBe(false)
    await expect(service.onApplicationBootstrap()).rejects.toThrow(
      DICTIONARY.search.unavailable,
    )
  })

  it("возвращает false при отклонении запроса к поисковику", async () => {
    const health = jest
      .fn<Meilisearch["health"]>()
      .mockRejectedValue(new Error("offline"))
    const service = new SearchHealthService({
      health,
    } as unknown as Meilisearch)

    await expect(service.healthCheck()).resolves.toBe(false)
  })
})
