import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals"
import { HttpAdapterHost } from "@nestjs/core"
import { Test, type TestingModule } from "@nestjs/testing"

import { SecurityCookieService } from "../services/cookie.service"
import { JWT_ACCESS_EXPIRATION } from "../static/JWT_ACCESS_EXPIRATION"
import { JWT_REFRESH_EXPIRATION } from "../static/JWT_REFRESH_EXPIRATION"

describe("SecurityCookieService", () => {
  const adapter = {
    setCookie: jest.fn<HttpAdapterHost["httpAdapter"]["setCookie"]>(),
    clearCookie: jest.fn<HttpAdapterHost["httpAdapter"]["clearCookie"]>(),
  }
  let moduleRef: TestingModule
  let service: SecurityCookieService

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [
        SecurityCookieService,
        { provide: HttpAdapterHost, useValue: { httpAdapter: adapter } },
      ],
    }).compile()
    service = moduleRef.get(SecurityCookieService)
  })

  beforeEach(() => {
    jest.resetAllMocks()
  })

  afterAll(async () => {
    await moduleRef?.close()
  })

  it("устанавливает оба токена с защитными флагами и сроками жизни в секундах", () => {
    const reply = {}
    const tokens = {
      accessToken: "access-token",
      refreshToken: "refresh-token",
    }

    service.setAuthCookies(reply, tokens)

    expect(adapter.setCookie).toHaveBeenCalledTimes(2)
    expect(adapter.setCookie).toHaveBeenCalledWith(
      reply,
      "__Host-accessToken",
      tokens.accessToken,
      {
        httpOnly: true,
        secure: true,
        sameSite: "strict",
        path: "/",
        maxAge: JWT_ACCESS_EXPIRATION,
      },
    )
    expect(adapter.setCookie).toHaveBeenCalledWith(
      reply,
      "__Host-refreshToken",
      tokens.refreshToken,
      {
        httpOnly: true,
        secure: true,
        sameSite: "strict",
        path: "/",
        maxAge: JWT_REFRESH_EXPIRATION,
      },
    )
    expect(adapter.clearCookie).not.toHaveBeenCalled()
  })

  it("удаляет обе cookie с совпадающими путём и защитными флагами", () => {
    const reply = {}

    service.clearAuthCookies(reply)

    expect(adapter.clearCookie).toHaveBeenCalledTimes(2)
    for (const name of ["__Host-accessToken", "__Host-refreshToken"]) {
      expect(adapter.clearCookie).toHaveBeenCalledWith(reply, name, {
        httpOnly: true,
        secure: true,
        sameSite: "strict",
        path: "/",
      })
    }
    expect(adapter.setCookie).not.toHaveBeenCalled()
  })

  it("передаёт вызывающему коду ошибку установки cookie", () => {
    const error = new Error("set cookie failed")
    adapter.setCookie.mockImplementationOnce(() => {
      throw error
    })

    expect(() =>
      service.setAuthCookies(
        {},
        { accessToken: "access", refreshToken: "refresh" },
      ),
    ).toThrow(error)
  })

  it("передаёт вызывающему коду ошибку удаления cookie", () => {
    const error = new Error("clear cookie failed")
    adapter.clearCookie.mockImplementationOnce(() => {
      throw error
    })

    expect(() => service.clearAuthCookies({})).toThrow(error)
  })
})
