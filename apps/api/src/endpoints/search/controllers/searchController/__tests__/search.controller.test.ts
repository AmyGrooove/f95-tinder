import { describe, expect, it, jest } from "@jest/globals"

import type { SiteSearchService } from "@endpoints/search/services/siteSearchService"

import { SearchController } from "../core/search.controller"

describe("SearchController", () => {
  it("передаёт запрос поиска сервису и возвращает его ответ", async () => {
    const result = { items: [], collections: [], users: [], nextCursor: null }
    const search = jest
      .fn<SiteSearchService["search"]>()
      .mockResolvedValue(result)
    const controller = new SearchController({
      search,
    } as unknown as SiteSearchService)
    const body = { search: "Орбита", limit: 10 } as const

    await expect(controller.search(body)).resolves.toBe(result)
    expect(search).toHaveBeenCalledWith(body)
  })
})
