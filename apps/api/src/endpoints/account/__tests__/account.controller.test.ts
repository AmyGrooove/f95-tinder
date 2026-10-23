import { describe, expect, it, jest } from "@jest/globals"
import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
  ValidationPipe,
} from "@nestjs/common"
import { Test } from "@nestjs/testing"

import { EUserRole } from "@entities/user/schemas/EUserRole"

import { AccountController } from "../controllers/account.controller"
import { AccountService } from "../services/account.service"
import { DisplayNameBodyDto } from "../dto/body/displayName.body"
import { UsernameBodyDto } from "../dto/body/username.body"

describe("AccountController", () => {
  it.each([
    { field: "username", value: "a".repeat(32), isValid: true },
    { field: "username", value: `  ${"A".repeat(32)}  `, isValid: true },
    { field: "username", value: "a".repeat(33), isValid: false },
    { field: "displayName", value: "Я".repeat(40), isValid: true },
    { field: "displayName", value: `  ${"Я".repeat(40)}  `, isValid: true },
    { field: "displayName", value: "😀".repeat(40), isValid: true },
    { field: "displayName", value: "Я".repeat(41), isValid: false },
    { field: "displayName", value: "😀".repeat(41), isValid: false },
  ])(
    "проверяет длину $field после нормализации: $value, допустимость: $isValid",
    async ({ field, value, isValid }) => {
      const pipe = new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      })
      const result = pipe.transform(
        { [field]: value },
        {
          type: "body",
          metatype: field === "username" ? UsernameBodyDto : DisplayNameBodyDto,
        },
      )

      if (isValid) {
        await expect(result).resolves.toMatchObject({
          [field]:
            field === "username" ? value.trim().toLowerCase() : value.trim(),
        })
      } else {
        await expect(result).rejects.toBeInstanceOf(BadRequestException)
      }
    },
  )

  const createController = async () => {
    const service = {
      updateDisplayName: jest.fn<AccountService["updateDisplayName"]>(),
      updateUsername: jest.fn<AccountService["updateUsername"]>(),
      getAccount: jest.fn<AccountService["getAccount"]>(),
      whoami: jest.fn<AccountService["whoami"]>(),
    }
    const moduleRef = await Test.createTestingModule({
      controllers: [AccountController],
      providers: [{ provide: AccountService, useValue: service }],
    }).compile()

    return { controller: moduleRef.get(AccountController), service }
  }

  it("передаёт токен и новое отображаемое имя сервису и возвращает пустой результат", async () => {
    const { controller, service } = await createController()
    const body = { displayName: "Новое имя" }
    service.updateDisplayName.mockResolvedValue(undefined)

    await expect(
      controller.updateDisplayName("access-token", body),
    ).resolves.toBeUndefined()

    expect(service.updateDisplayName).toHaveBeenCalledTimes(1)
    expect(service.updateDisplayName).toHaveBeenCalledWith("access-token", body)
  })

  it("передаёт токен и новое имя пользователя сервису и возвращает пустой результат", async () => {
    const { controller, service } = await createController()
    const body = { username: "new_username" }
    service.updateUsername.mockResolvedValue(undefined)

    await expect(
      controller.updateUsername("access-token", body),
    ).resolves.toBeUndefined()

    expect(service.updateUsername).toHaveBeenCalledTimes(1)
    expect(service.updateUsername).toHaveBeenCalledWith("access-token", body)
  })

  it("возвращает данные аккаунта, полученные от сервиса", async () => {
    const { controller, service } = await createController()
    const account = {
      id: "507f1f77bcf86cd799439011",
      username: "username",
      displayName: "Имя",
      avatarUrl: null,
      role: EUserRole.USER,
      email: "user@example.test",
      isPasswordSet: true,
      isAccessCodeSet: false,
      createdAt: "2026-10-20T00:00:00.000Z",
      updatedAt: "2026-10-21T00:00:00.000Z",
    }
    service.getAccount.mockResolvedValue(account)

    await expect(controller.getAccount("access-token")).resolves.toBe(account)

    expect(service.getAccount).toHaveBeenCalledTimes(1)
    expect(service.getAccount).toHaveBeenCalledWith("access-token")
  })

  it("возвращает пользователя и текущую сессию, полученные от сервиса", async () => {
    const { controller, service } = await createController()
    const result = {
      user: {
        id: "507f1f77bcf86cd799439011",
        username: "username",
        displayName: "Имя",
        avatarUrl: null,
        role: EUserRole.USER,
      },
      session: {
        id: "507f1f77bcf86cd799439012",
        expiresAt: "2026-10-22T00:00:00.000Z",
      },
    }
    service.whoami.mockResolvedValue(result)

    await expect(controller.whoami("access-token")).resolves.toBe(result)

    expect(service.whoami).toHaveBeenCalledTimes(1)
    expect(service.whoami).toHaveBeenCalledWith("access-token")
  })

  it("сохраняет ошибку сервиса при изменении отображаемого имени", async () => {
    const { controller, service } = await createController()
    const error = new UnauthorizedException()
    service.updateDisplayName.mockRejectedValue(error)

    await expect(
      controller.updateDisplayName("access-token", { displayName: "Имя" }),
    ).rejects.toBe(error)
  })

  it("сохраняет ошибку конфликта имени пользователя", async () => {
    const { controller, service } = await createController()
    const error = new ConflictException()
    service.updateUsername.mockRejectedValue(error)

    await expect(
      controller.updateUsername("access-token", { username: "taken" }),
    ).rejects.toBe(error)
  })

  it.each(["getAccount", "whoami"] as const)(
    "%s передаёт отсутствующий токен сервису и сохраняет ошибку авторизации",
    async (method) => {
      const { controller, service } = await createController()
      const error = new UnauthorizedException()
      service[method].mockRejectedValue(error)

      await expect(controller[method](undefined)).rejects.toBe(error)

      expect(service[method]).toHaveBeenCalledWith(undefined)
    },
  )
})
