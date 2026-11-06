import { describe, expect, it, jest } from "@jest/globals"
import { UnauthorizedException, type ExecutionContext } from "@nestjs/common"

import type { SecurityJwtService } from "@infrastructure/security/services/jwtService"
import type { ICurrentUserRequest } from "@infrastructure/security/types/ICurrentUserRequest"
import { AccessTokenGuard } from "../core/accessToken.guard"

const createGuard = (authorization?: string) => {
  const verifyAccessToken = jest.fn<SecurityJwtService["verifyAccessToken"]>()
  const guard = new AccessTokenGuard({
    verifyAccessToken,
  } as unknown as SecurityJwtService)
  const request: ICurrentUserRequest & { headers: { authorization?: string } } =
    { headers: { authorization } }
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as ExecutionContext

  return { guard, request, context, verifyAccessToken }
}

describe("AccessTokenGuard", () => {
  it.each([undefined, "Basic abc", "Bearer ", "Bearer abc def"])(
    "отклоняет заголовок %j без проверки JWT",
    async (header) => {
      const { guard, context, request, verifyAccessToken } = createGuard(header)

      await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
        UnauthorizedException,
      )
      expect(verifyAccessToken).not.toHaveBeenCalled()
      expect(request.authPrincipal).toBeUndefined()
    },
  )

  it("заполняет пользователя из проверенного токена с регистронезависимой схемой", async () => {
    const { guard, context, request, verifyAccessToken } =
      createGuard("bEaReR jwt")
    verifyAccessToken.mockResolvedValue({
      sub: "user",
      sessionId: "session",
      role: "admin",
      type: "access",
    })

    await expect(guard.canActivate(context)).resolves.toBe(true)
    expect(verifyAccessToken).toHaveBeenCalledWith("jwt")
    expect(request.authPrincipal).toEqual({
      id: "user",
      sessionId: "session",
      role: "admin",
    })
  })

  it("передаёт ошибку проверки токена и оставляет запрос без пользователя", async () => {
    const { guard, context, request, verifyAccessToken } =
      createGuard("Bearer invalid")
    const error = new UnauthorizedException("invalid token")
    verifyAccessToken.mockRejectedValue(error)

    await expect(guard.canActivate(context)).rejects.toBe(error)
    expect(request.authPrincipal).toBeUndefined()
  })
})
