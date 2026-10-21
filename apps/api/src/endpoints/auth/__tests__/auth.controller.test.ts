import { describe, expect, it, jest } from "@jest/globals"
import {
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common"
import { Test } from "@nestjs/testing"

import { SecurityCookieService } from "@infrastructure/security/services/cookie.service"

import { AuthController } from "../controllers/auth.controller"
import { AuthService } from "../services/auth.service"

describe("AuthController", () => {
  const createController = async () => {
    const service = {
      login: jest.fn<AuthService["login"]>(),
      loginByCode: jest.fn<AuthService["loginByCode"]>(),
      logout: jest.fn<AuthService["logout"]>(),
      register: jest.fn<AuthService["register"]>(),
    }
    const cookies = {
      setAuthCookies: jest.fn<SecurityCookieService["setAuthCookies"]>(),
      clearAuthCookies: jest.fn<SecurityCookieService["clearAuthCookies"]>(),
    }
    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: service },
        { provide: SecurityCookieService, useValue: cookies },
      ],
    }).compile()

    return { controller: moduleRef.get(AuthController), service, cookies }
  }

  describe.each(["browser", undefined])("User-Agent: %s", (userAgent) => {
    it("передаёт логин и пароль сервису и устанавливает полученные cookies", async () => {
      const { controller, service, cookies } = await createController()
      const body = { username: "username", password: "Password-123" }
      const tokens = { accessToken: "access", refreshToken: "refresh" }
      const reply = {}
      service.login.mockResolvedValue(tokens)

      await expect(
        controller.login(body, userAgent, reply),
      ).resolves.toBeUndefined()

      expect(service.login).toHaveBeenCalledTimes(1)
      expect(service.login).toHaveBeenCalledWith(body, userAgent)
      expect(cookies.setAuthCookies).toHaveBeenCalledTimes(1)
      expect(cookies.setAuthCookies).toHaveBeenCalledWith(reply, tokens)
      expect(cookies.clearAuthCookies).not.toHaveBeenCalled()
    })

    it("передаёт секретный код сервису и устанавливает полученные cookies", async () => {
      const { controller, service, cookies } = await createController()
      const body = { accessCode: "A".repeat(32) }
      const tokens = { accessToken: "access", refreshToken: "refresh" }
      const reply = {}
      service.loginByCode.mockResolvedValue(tokens)

      await expect(
        controller.loginByCode(body, userAgent, reply),
      ).resolves.toBeUndefined()

      expect(service.loginByCode).toHaveBeenCalledTimes(1)
      expect(service.loginByCode).toHaveBeenCalledWith(body, userAgent)
      expect(cookies.setAuthCookies).toHaveBeenCalledTimes(1)
      expect(cookies.setAuthCookies).toHaveBeenCalledWith(reply, tokens)
      expect(cookies.clearAuthCookies).not.toHaveBeenCalled()
    })

    it("возвращает только логин и код регистрации, передавая токены в cookies", async () => {
      const { controller, service, cookies } = await createController()
      const result = {
        username: "username",
        accessCode: "A".repeat(32),
        accessToken: "access",
        refreshToken: "refresh",
      }
      const reply = {}
      service.register.mockResolvedValue(result)

      await expect(controller.register(userAgent, reply)).resolves.toEqual({
        username: result.username,
        accessCode: result.accessCode,
      })

      expect(service.register).toHaveBeenCalledTimes(1)
      expect(service.register).toHaveBeenCalledWith(userAgent)
      expect(cookies.setAuthCookies).toHaveBeenCalledTimes(1)
      expect(cookies.setAuthCookies).toHaveBeenCalledWith(reply, result)
      expect(cookies.clearAuthCookies).not.toHaveBeenCalled()
    })
  })

  it("завершает сессию перед очисткой cookies", async () => {
    const { controller, service, cookies } = await createController()
    const reply = {}
    service.logout.mockImplementation(async () => {
      expect(cookies.clearAuthCookies).not.toHaveBeenCalled()
    })

    await expect(controller.logout("access", reply)).resolves.toBeUndefined()

    expect(service.logout).toHaveBeenCalledTimes(1)
    expect(service.logout).toHaveBeenCalledWith("access")
    expect(cookies.clearAuthCookies).toHaveBeenCalledTimes(1)
    expect(cookies.clearAuthCookies).toHaveBeenCalledWith(reply)
    expect(cookies.setAuthCookies).not.toHaveBeenCalled()
  })

  it.each(["login", "loginByCode", "register", "logout"] as const)(
    "сохраняет ошибку сервиса %s и не изменяет cookies",
    async (method) => {
      const { controller, service, cookies } = await createController()
      const error =
        method === "register"
          ? new ServiceUnavailableException()
          : new UnauthorizedException()
      service[method].mockRejectedValue(error)
      const reply = {}
      const call = () => {
        switch (method) {
          case "login":
            return controller.login(
              { username: "username", password: "Password-123" },
              undefined,
              reply,
            )
          case "loginByCode":
            return controller.loginByCode(
              { accessCode: "A".repeat(32) },
              undefined,
              reply,
            )
          case "register":
            return controller.register(undefined, reply)
          case "logout":
            return controller.logout(undefined, reply)
        }
      }

      await expect(call()).rejects.toBe(error)

      expect(cookies.setAuthCookies).not.toHaveBeenCalled()
      expect(cookies.clearAuthCookies).not.toHaveBeenCalled()
    },
  )
})
