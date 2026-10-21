import { describe, expect, it } from "@jest/globals"

import { getTestApplication } from "@test/setup/setupIntegration"

import { MongoHealthService } from "../services/mongoHealth.service"

describe("MongoHealthService MongoDB", () => {
  it("проверяет настоящее соединение и успешно проходит bootstrap", async () => {
    const service = new MongoHealthService(getTestApplication().connection)

    await expect(service.healthCheck()).resolves.toBe(true)
    await expect(service.onApplicationBootstrap()).resolves.toBeUndefined()
  })
})
