import { describe, expect, it, jest } from "@jest/globals"

import type { HealthService } from "../../services/healthService"
import { HealthController } from "../health.controller"

describe("HealthController", () => {
  it("возвращает результат проверки готовности", async () => {
    const result = { status: "ok", error: {}, details: {} } as const
    const service = { checkHealth: jest.fn(async () => result) }
    const controller = new HealthController(service as unknown as HealthService)

    await expect(controller.getHealth()).resolves.toEqual(result)
    expect(service.checkHealth).toHaveBeenCalledTimes(1)
  })

  it("возвращает признак активности без проверки готовности", () => {
    const service = { checkHealth: jest.fn() }
    const controller = new HealthController(service as unknown as HealthService)

    expect(controller.getLiveness()).toEqual({ status: "ok" })
    expect(service.checkHealth).not.toHaveBeenCalled()
  })
})
