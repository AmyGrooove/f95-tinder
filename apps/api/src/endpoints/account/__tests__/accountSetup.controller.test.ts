import { afterEach, describe, expect, it, jest } from "@jest/globals"
import {
  BadRequestException,
  ConflictException,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common"
import { Test, type TestingModule } from "@nestjs/testing"

import { AccountSetupController } from "../controllers/accountSetup.controller"
import { AccountSetupService } from "../services/accountSetup.service"

describe("AccountSetupController", () => {
  let moduleRef: TestingModule | undefined

  afterEach(async () => {
    await moduleRef?.close()
    moduleRef = undefined
  })

  const createController = async () => {
    const service = {
      confirmSetup: jest.fn<AccountSetupService["confirmSetup"]>(),
      requestSetup: jest.fn<AccountSetupService["requestSetup"]>(),
    }
    moduleRef = await Test.createTestingModule({
      controllers: [AccountSetupController],
      providers: [{ provide: AccountSetupService, useValue: service }],
    }).compile()

    return { controller: moduleRef.get(AccountSetupController), service }
  }

  it("передаёт токен и данные настройки сервису и возвращает пустой результат", async () => {
    const { controller, service } = await createController()
    const body = {
      email: "user@example.test",
      password: "password",
      accessCode: "a".repeat(32),
    }
    service.requestSetup.mockResolvedValue(undefined)

    await expect(
      controller.requestSetup("access-token", body),
    ).resolves.toBeUndefined()

    expect(service.requestSetup).toHaveBeenCalledTimes(1)
    expect(service.requestSetup).toHaveBeenCalledWith("access-token", body)
  })

  it("передаёт токен и код подтверждения настройки сервису и возвращает пустой результат", async () => {
    const { controller, service } = await createController()
    const body = { code: "123456" }
    service.confirmSetup.mockResolvedValue(undefined)

    await expect(
      controller.confirmSetup("access-token", body),
    ).resolves.toBeUndefined()

    expect(service.confirmSetup).toHaveBeenCalledTimes(1)
    expect(service.confirmSetup).toHaveBeenCalledWith("access-token", body)
  })

  it.each([
    new UnauthorizedException(),
    new ConflictException(),
    new ServiceUnavailableException(),
  ])("сохраняет ошибку запроса настройки аккаунта %s", async (error) => {
    const { controller, service } = await createController()
    service.requestSetup.mockRejectedValue(error)

    await expect(
      controller.requestSetup("access-token", {
        email: "user@example.test",
        password: "password",
        accessCode: "a".repeat(32),
      }),
    ).rejects.toBe(error)
  })

  it.each([new BadRequestException(), new ConflictException()])(
    "сохраняет ошибку подтверждения настройки аккаунта %s",
    async (error) => {
      const { controller, service } = await createController()
      service.confirmSetup.mockRejectedValue(error)

      await expect(
        controller.confirmSetup("access-token", { code: "123456" }),
      ).rejects.toBe(error)
    },
  )

  it("передаёт отсутствующий токен сервису подтверждения настройки", async () => {
    const { controller, service } = await createController()
    const error = new UnauthorizedException()
    service.confirmSetup.mockRejectedValue(error)

    await expect(
      controller.confirmSetup(undefined, { code: "123456" }),
    ).rejects.toBe(error)

    expect(service.confirmSetup).toHaveBeenCalledWith(undefined, {
      code: "123456",
    })
  })
})
