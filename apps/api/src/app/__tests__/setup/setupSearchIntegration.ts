import { afterAll, beforeAll, beforeEach } from "@jest/globals"

import { SEARCH_SETTINGS } from "@endpoints/search/static/SEARCH_SETTINGS"
import { createTestMeilisearch } from "@infrastructure/search/__tests__/setup/createTestMeilisearch"
import { SearchService } from "@infrastructure/search/services/searchService"

import { createTestApplication } from "./createTestApplication"

let meilisearch: Awaited<ReturnType<typeof createTestMeilisearch>> | undefined
let application: Awaited<ReturnType<typeof createTestApplication>> | undefined

const getSearchTestApplication = () => {
  if (application === undefined || meilisearch === undefined) {
    throw new Error("Тестовое приложение с поиском ещё не запущено")
  }

  return { ...application, client: meilisearch.client }
}

beforeAll(async () => {
  meilisearch = await createTestMeilisearch()
  application = await createTestApplication(meilisearch.configuration)
}, 300_000)

beforeEach(async () => {
  const { app, reset } = getSearchTestApplication()
  await reset()
  const search = app.get(SearchService)

  for (const index of Object.values(SEARCH_SETTINGS.indexes)) {
    if (await search.hasIndex(index)) {
      await search.clear(index, true)
    }
  }
})

afterAll(async () => {
  try {
    await application?.close()
  } finally {
    await meilisearch?.close()
  }
}, 60_000)

export { getSearchTestApplication }
