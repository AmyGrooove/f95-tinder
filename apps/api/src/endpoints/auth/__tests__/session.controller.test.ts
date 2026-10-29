import { afterEach, describe, expect, it, jest } from "@jest/globals"
import { NotFoundException, UnauthorizedException } from "@nestjs/common"
import { Test, type TestingModule } from "@nestjs/testing"
import { Types } from "mongoose"
import { ECountry } from "@entities/shared/schemas/ECountry"

import { SecurityCookieService } from "@infrastructure/security/services/cookie.service"

import { SessionController } from "../controllers/session.controller"
import { SessionService } from "../services/session.service"

describe("SessionController", () => {
  let moduleRef: TestingModule | undefined

  afterEach(async () => {
    await moduleRef?.close()
    moduleRef = undefined
  })

  const createController = async () => {
    const service = {
      getSessions: jest.fn<SessionService["getSessions"]>(),
      deleteOtherSessions: jest.fn<SessionService["deleteOtherSessions"]>(),
      deleteSession: jest.fn<SessionService["deleteSession"]>(),
      refresh: jest.fn<SessionService["refresh"]>(),
    }
    const cookies = {
      setAuthCookies: jest.fn<SecurityCookieService["setAuthCookies"]>(),
      clearAuthCookies: jest.fn<SecurityCookieService["clearAuthCookies"]>(),
    }
    moduleRef = await Test.createTestingModule({
      controllers: [SessionController],
      providers: [
        { provide: SessionService, useValue: service },
        { provide: SecurityCookieService, useValue: cookies },
      ],
    }).compile()

    return { controller: moduleRef.get(SessionController), service, cookies }
  }

  it("возвращает список сессий сервиса без изменения cookies", async () => {
    const { controller, service, cookies } = await createController()
    const sessions = [
      {
        id: new Types.ObjectId().toHexString(),
        userAgent: null,
        country: ECountry.UNKNOWN,
        createdAt: "2026-10-22T00:00:00.000Z",
        expiresAt: "2026-10-23T00:00:00.000Z",
        lastRefreshedAt: null,
        isCurrent: true,
      },
    ]
    service.getSessions.mockResolvedValue(sessions)

    await expect(controller.getSessions("access")).resolves.toBe(sessions)

    expect(service.getSessions).toHaveBeenCalledTimes(1)
    expect(service.getSessions).toHaveBeenCalledWith("access")
    expect(cookies.setAuthCookies).not.toHaveBeenCalled()
    expect(cookies.clearAuthCookies).not.toHaveBeenCalled()
  })

  it("передаёт access-токен сервису удаления остальных сессий без изменения cookies", async () => {
    const { controller, service, cookies } = await createController()
    service.deleteOtherSessions.mockResolvedValue(undefined)

    await expect(
      controller.deleteOtherSessions("access"),
    ).resolves.toBeUndefined()

    expect(service.deleteOtherSessions).toHaveBeenCalledTimes(1)
    expect(service.deleteOtherSessions).toHaveBeenCalledWith("access")
    expect(cookies.setAuthCookies).not.toHaveBeenCalled()
    expect(cookies.clearAuthCookies).not.toHaveBeenCalled()
  })

  it.each([true, false])(
    "передаёт ObjectId сервису и очищает cookies только для текущей сессии: %s",
    async (isCurrent) => {
      const { controller, service, cookies } = await createController()
      const sessionId = new Types.ObjectId()
      const reply = {}
      service.deleteSession.mockImplementation(async () => {
        expect(cookies.clearAuthCookies).not.toHaveBeenCalled()
        return isCurrent
      })

      await expect(
        controller.deleteSession("access", sessionId, reply),
      ).resolves.toBeUndefined()

      expect(service.deleteSession).toHaveBeenCalledTimes(1)
      expect(service.deleteSession).toHaveBeenCalledWith("access", sessionId)
      expect(cookies.clearAuthCookies).toHaveBeenCalledTimes(isCurrent ? 1 : 0)
      if (isCurrent) {
        expect(cookies.clearAuthCookies).toHaveBeenCalledWith(reply)
      }
      expect(cookies.setAuthCookies).not.toHaveBeenCalled()
    },
  )

  it("устанавливает cookies с токенами только после успешного обновления сессии", async () => {
    const { controller, service, cookies } = await createController()
    const tokens = { accessToken: "new-access", refreshToken: "new-refresh" }
    const reply = {}
    service.refresh.mockImplementation(async () => {
      expect(cookies.setAuthCookies).not.toHaveBeenCalled()
      return tokens
    })

    await expect(controller.refresh("refresh", reply)).resolves.toBeUndefined()

    expect(service.refresh).toHaveBeenCalledTimes(1)
    expect(service.refresh).toHaveBeenCalledWith("refresh")
    expect(cookies.setAuthCookies).toHaveBeenCalledTimes(1)
    expect(cookies.setAuthCookies).toHaveBeenCalledWith(reply, tokens)
    expect(cookies.clearAuthCookies).not.toHaveBeenCalled()
  })

  it.each([
    "getSessions",
    "deleteOtherSessions",
    "deleteSession",
    "refresh",
  ] as const)(
    "сохраняет ошибку авторизации %s без изменения cookies",
    async (method) => {
      const { controller, service, cookies } = await createController()
      const error = new UnauthorizedException()
      service[method].mockRejectedValue(error)
      const call = () => {
        switch (method) {
          case "getSessions":
            return controller.getSessions(undefined)
          case "deleteOtherSessions":
            return controller.deleteOtherSessions(undefined)
          case "deleteSession":
            return controller.deleteSession(undefined, new Types.ObjectId(), {})
          case "refresh":
            return controller.refresh(undefined, {})
        }
      }

      await expect(call()).rejects.toBe(error)

      expect(service[method]).toHaveBeenCalledTimes(1)
      expect(service[method].mock.calls[0]?.[0]).toBeUndefined()
      expect(cookies.setAuthCookies).not.toHaveBeenCalled()
      expect(cookies.clearAuthCookies).not.toHaveBeenCalled()
    },
  )

  it("сохраняет ошибку отсутствующей целевой сессии и не очищает cookies", async () => {
    const { controller, service, cookies } = await createController()
    const error = new NotFoundException()
    service.deleteSession.mockRejectedValue(error)

    await expect(
      controller.deleteSession("access", new Types.ObjectId(), {}),
    ).rejects.toBe(error)

    expect(cookies.setAuthCookies).not.toHaveBeenCalled()
    expect(cookies.clearAuthCookies).not.toHaveBeenCalled()
  })
})
