import { describe, expect, it, jest } from "@jest/globals"
import type { Resend } from "resend"

import { MailHealthService } from "../core/mailHealth.service"

describe("MailHealthService", () => {
  it.each([
    { error: null, isExpectedHealthy: true },
    { error: { message: "denied" }, isExpectedHealthy: false },
  ])(
    "определяет доступность по ответу провайдера $error",
    async ({ error, isExpectedHealthy }) => {
      const list = jest.fn(async () => ({ error }))
      const service = new MailHealthService({
        domains: { list },
      } as unknown as Resend)

      await expect(service.healthCheck()).resolves.toBe(isExpectedHealthy)
    },
  )

  it("возвращает false при отклонении запроса провайдером", async () => {
    const list = jest
      .fn<Resend["domains"]["list"]>()
      .mockRejectedValue(new Error("offline"))
    const service = new MailHealthService({
      domains: { list },
    } as unknown as Resend)

    await expect(service.healthCheck()).resolves.toBe(false)
  })
})
