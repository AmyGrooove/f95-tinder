import { afterEach, describe, expect, it, jest } from "@jest/globals"
import { BadRequestException } from "@nestjs/common"
import { Test, type TestingModule } from "@nestjs/testing"

import { SecurityCookieService } from "@infrastructure/security/services/cookie.service"

import { PasswordResetController } from "../controllers/passwordReset.controller"
import { PasswordResetService } from "../services/passwordReset.service"

describe("PasswordResetController", () => {
  let moduleRef: TestingModule | undefined

  afterEach(async () => {
    await moduleRef?.close()
    moduleRef = undefined
  })

  const createController = async () => {
    const service = {
      requestReset: jest.fn<PasswordResetService["requestReset"]>(),
      confirmReset: jest.fn<PasswordResetService["confirmReset"]>(),
    }
    const cookies = {
      clearAuthCookies: jest.fn<SecurityCookieService["clearAuthCookies"]>(),
    }
    moduleRef = await Test.createTestingModule({
      controllers: [PasswordResetController],
      providers: [
        { provide: PasswordResetService, useValue: service },
        { provide: SecurityCookieService, useValue: cookies },
      ],
    }).compile()

    return {
      controller: moduleRef.get(PasswordResetController),
      service,
      cookies,
    }
  }

  it("передаёт email сервису и возвращает пустой результат без изменения cookies", async () => {
    const { controller, service, cookies } = await createController()
    const body = { email: "user@example.test" }
    service.requestReset.mockResolvedValue(undefined)

    await expect(controller.requestPasswordReset(body)).resolves.toBeUndefined()

    expect(service.requestReset).toHaveBeenCalledTimes(1)
    expect(service.requestReset).toHaveBeenCalledWith(body)
    expect(cookies.clearAuthCookies).not.toHaveBeenCalled()
  })

  it("ожидает подтверждение сброса перед очисткой cookies и возвращает пустой результат", async () => {
    const { controller, service, cookies } = await createController()
    const body = {
      email: "user@example.test",
      code: "012345",
      newPassword: " New-password-123 ",
    }
    const reply = {}
    service.confirmReset.mockImplementation(async () => {
      expect(cookies.clearAuthCookies).not.toHaveBeenCalled()
    })

    await expect(
      controller.confirmPasswordReset(body, reply),
    ).resolves.toBeUndefined()

    expect(service.confirmReset).toHaveBeenCalledTimes(1)
    expect(service.confirmReset).toHaveBeenCalledWith(body)
    expect(cookies.clearAuthCookies).toHaveBeenCalledTimes(1)
    expect(cookies.clearAuthCookies).toHaveBeenCalledWith(reply)
  })

  it.each([new BadRequestException(), new Error("Redis unavailable")])(
    "сохраняет ошибку запроса сброса без изменения cookies: %s",
    async (error) => {
      const { controller, service, cookies } = await createController()
      service.requestReset.mockRejectedValue(error)

      await expect(
        controller.requestPasswordReset({ email: "user@example.test" }),
      ).rejects.toBe(error)

      expect(cookies.clearAuthCookies).not.toHaveBeenCalled()
    },
  )

  it.each([new BadRequestException(), new Error("Database unavailable")])(
    "сохраняет ошибку подтверждения и не очищает cookies: %s",
    async (error) => {
      const { controller, service, cookies } = await createController()
      service.confirmReset.mockRejectedValue(error)

      await expect(
        controller.confirmPasswordReset(
          {
            email: "user@example.test",
            code: "012345",
            newPassword: "New-password-123",
          },
          {},
        ),
      ).rejects.toBe(error)

      expect(cookies.clearAuthCookies).not.toHaveBeenCalled()
    },
  )
})
