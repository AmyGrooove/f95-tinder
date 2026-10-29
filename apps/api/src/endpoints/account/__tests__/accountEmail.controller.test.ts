import { afterEach, describe, expect, it, jest } from "@jest/globals"
import {
  BadRequestException,
  ConflictException,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common"
import { Test, type TestingModule } from "@nestjs/testing"

import { AccountEmailController } from "../controllers/accountEmail.controller"
import { AccountEmailService } from "../services/accountEmail.service"

describe("AccountEmailController", () => {
  let moduleRef: TestingModule | undefined

  afterEach(async () => {
    await moduleRef?.close()
    moduleRef = undefined
  })

  const createController = async () => {
    const service = {
      confirmEmail: jest.fn<AccountEmailService["confirmEmail"]>(),
      requestEmail: jest.fn<AccountEmailService["requestEmail"]>(),
    }
    moduleRef = await Test.createTestingModule({
      controllers: [AccountEmailController],
      providers: [{ provide: AccountEmailService, useValue: service }],
    }).compile()

    return { controller: moduleRef.get(AccountEmailController), service }
  }

  it("передаёт токен, email и текущий пароль сервису и возвращает пустой результат", async () => {
    const { controller, service } = await createController()
    const body = { email: "user@example.test", currentPassword: "password" }
    service.requestEmail.mockResolvedValue(undefined)

    await expect(
      controller.requestEmail("access-token", body),
    ).resolves.toBeUndefined()

    expect(service.requestEmail).toHaveBeenCalledTimes(1)
    expect(service.requestEmail).toHaveBeenCalledWith("access-token", body)
  })

  it("передаёт токен и код подтверждения сервису и возвращает пустой результат", async () => {
    const { controller, service } = await createController()
    const body = { code: "123456" }
    service.confirmEmail.mockResolvedValue(undefined)

    await expect(
      controller.confirmEmail("access-token", body),
    ).resolves.toBeUndefined()

    expect(service.confirmEmail).toHaveBeenCalledTimes(1)
    expect(service.confirmEmail).toHaveBeenCalledWith("access-token", body)
  })

  it.each([
    new UnauthorizedException(),
    new ConflictException(),
    new ServiceUnavailableException(),
  ])("сохраняет ошибку запроса смены email %s", async (error) => {
    const { controller, service } = await createController()
    service.requestEmail.mockRejectedValue(error)

    await expect(
      controller.requestEmail("access-token", {
        email: "user@example.test",
        currentPassword: "password",
      }),
    ).rejects.toBe(error)
  })

  it.each([new BadRequestException(), new ConflictException()])(
    "сохраняет ошибку подтверждения email %s",
    async (error) => {
      const { controller, service } = await createController()
      service.confirmEmail.mockRejectedValue(error)

      await expect(
        controller.confirmEmail("access-token", { code: "123456" }),
      ).rejects.toBe(error)
    },
  )

  it("передаёт отсутствующий токен сервису подтверждения email", async () => {
    const { controller, service } = await createController()
    const error = new UnauthorizedException()
    service.confirmEmail.mockRejectedValue(error)

    await expect(
      controller.confirmEmail(undefined, { code: "123456" }),
    ).rejects.toBe(error)

    expect(service.confirmEmail).toHaveBeenCalledWith(undefined, {
      code: "123456",
    })
  })
})
