import { describe, expect, it, jest } from "@jest/globals"
import { ConflictException, UnauthorizedException } from "@nestjs/common"
import { Test } from "@nestjs/testing"

import { AuthService } from "@endpoints/auth/services/auth.service"
import { SecurityCookieService } from "@infrastructure/security/services/cookie.service"

import { AccountCredentialsController } from "../controllers/accountCredentials.controller"
import { AccountService } from "../services/account.service"

describe("AccountCredentialsController", () => {
  const createController = async () => {
    const accountService = {
      updatePassword: jest.fn<AccountService["updatePassword"]>(),
    }
    const authService = {
      reissueCode: jest.fn<AuthService["reissueCode"]>(),
    }
    const cookieService = {
      setAuthCookies: jest.fn<SecurityCookieService["setAuthCookies"]>(),
    }
    const moduleRef = await Test.createTestingModule({
      controllers: [AccountCredentialsController],
      providers: [
        { provide: AccountService, useValue: accountService },
        { provide: AuthService, useValue: authService },
        { provide: SecurityCookieService, useValue: cookieService },
      ],
    }).compile()

    return {
      controller: moduleRef.get(AccountCredentialsController),
      accountService,
      authService,
      cookieService,
    }
  }

  it("меняет пароль, устанавливает новые cookies и возвращает пустой результат", async () => {
    const { controller, accountService, cookieService } =
      await createController()
    const body = {
      currentPassword: "old-password",
      newPassword: "new-password",
    }
    const tokens = {
      accessToken: "new-access-token",
      refreshToken: "new-refresh-token",
    }
    const reply = {}
    accountService.updatePassword.mockResolvedValue(tokens)

    await expect(
      controller.updatePassword("access-token", body, reply),
    ).resolves.toBeUndefined()

    expect(accountService.updatePassword).toHaveBeenCalledTimes(1)
    expect(accountService.updatePassword).toHaveBeenCalledWith(
      "access-token",
      body,
    )
    expect(cookieService.setAuthCookies).toHaveBeenCalledTimes(1)
    expect(cookieService.setAuthCookies).toHaveBeenCalledWith(reply, tokens)
  })

  it.each([new UnauthorizedException(), new ConflictException()])(
    "сохраняет ошибку смены пароля %s и не устанавливает cookies",
    async (error) => {
      const { controller, accountService, cookieService } =
        await createController()
      accountService.updatePassword.mockRejectedValue(error)

      await expect(
        controller.updatePassword(
          "access-token",
          {
            currentPassword: "old-password",
            newPassword: "new-password",
          },
          {},
        ),
      ).rejects.toBe(error)

      expect(cookieService.setAuthCookies).not.toHaveBeenCalled()
    },
  )

  it("перевыпускает код, устанавливает cookies и возвращает только новый код без токенов", async () => {
    const { controller, authService, cookieService } = await createController()
    const body = { accessCode: "a".repeat(32) }
    const result = {
      accessToken: "new-access-token",
      refreshToken: "new-refresh-token",
      accessCode: "b".repeat(32),
    }
    const reply = {}
    authService.reissueCode.mockResolvedValue(result)

    await expect(
      controller.reissueCode("access-token", body, reply),
    ).resolves.toEqual({
      accessCode: result.accessCode,
    })

    expect(authService.reissueCode).toHaveBeenCalledTimes(1)
    expect(authService.reissueCode).toHaveBeenCalledWith("access-token", body)
    expect(cookieService.setAuthCookies).toHaveBeenCalledTimes(1)
    expect(cookieService.setAuthCookies).toHaveBeenCalledWith(reply, result)
  })

  it("сохраняет ошибку перевыпуска кода и не устанавливает cookies", async () => {
    const { controller, authService, cookieService } = await createController()
    const error = new UnauthorizedException()
    authService.reissueCode.mockRejectedValue(error)

    await expect(
      controller.reissueCode(undefined, { accessCode: "a".repeat(32) }, {}),
    ).rejects.toBe(error)

    expect(authService.reissueCode).toHaveBeenCalledWith(undefined, {
      accessCode: "a".repeat(32),
    })
    expect(cookieService.setAuthCookies).not.toHaveBeenCalled()
  })
})
