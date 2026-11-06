import { describe, expect, it, jest } from "@jest/globals"

import { SchedulerHealthService } from "../core/schedulerHealth.service"
import { SCHEDULER_HEALTH_TIMEOUT_MS } from "../static/SCHEDULER_HEALTH_TIMEOUT_MS"

describe("SchedulerHealthService", () => {
  it("считает планировщик доступным до истечения таймаута включительно", () => {
    const now = jest.spyOn(performance, "now").mockReturnValue(100)
    const service = new SchedulerHealthService()

    now.mockReturnValue(100 + SCHEDULER_HEALTH_TIMEOUT_MS)
    expect(service.checkHealth()).toBe(true)

    now.mockReturnValue(101 + SCHEDULER_HEALTH_TIMEOUT_MS)
    expect(service.checkHealth()).toBe(false)
  })

  it("отсчитывает время от запуска приложения, если ещё не было heartbeat", () => {
    const now = jest.spyOn(performance, "now").mockReturnValue(0)
    const service = new SchedulerHealthService()

    now.mockReturnValue(SCHEDULER_HEALTH_TIMEOUT_MS + 1)
    expect(service.checkHealth()).toBe(false)

    service.onApplicationBootstrap()

    expect(service.checkHealth()).toBe(true)
  })
})
