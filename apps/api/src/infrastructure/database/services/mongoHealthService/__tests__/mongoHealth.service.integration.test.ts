import { describe, expect, it } from "@jest/globals"

import { getTestDatabase } from "../../../__tests__/setup/setupDatabase"

import { MongoHealthService } from "../core/mongoHealth.service"

describe("MongoHealthService MongoDB", () => {
  it("проверяет настоящее соединение и успешно проходит bootstrap", async () => {
    const service = new MongoHealthService(getTestDatabase().connection)

    await expect(service.healthCheck()).resolves.toBe(true)
    await expect(service.onApplicationBootstrap()).resolves.toBeUndefined()
  })
})
