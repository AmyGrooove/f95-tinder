import { describe, expect, it } from "@jest/globals"

import { createTestConfiguration } from "@infrastructure/config/__tests__/setup/createTestConfiguration"
import { InfrastructureConfigService } from "../core/config.service"

describe("InfrastructureConfigService", () => {
  it("возвращает каждый внедрённый раздел конфигурации", () => {
    const config = createTestConfiguration(
      "mongodb://localhost:27017/test",
      "redis://localhost:6379/2",
    )
    const service = new InfrastructureConfigService(config)

    for (const key of Object.keys(config) as (keyof typeof config)[]) {
      expect(service[key]).toBe(config[key])
    }
  })
})
