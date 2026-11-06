import { describe, expect, it, jest } from "@jest/globals"
import { UnauthorizedException } from "@nestjs/common"
import { Types } from "mongoose"

import type { AuthService } from "@endpoints/auth/services/authService"
import type { UserRepository } from "@entities/user/services/userRepository"
import { requestContext } from "@shared/functions/context/requestContext"

import { CollectionAuthService } from "../core/collectionAuth.service"

describe("CollectionAuthService", () => {
  const userId = new Types.ObjectId()
  const payload = {
    sub: userId.toHexString(),
    sessionId: new Types.ObjectId().toHexString(),
  }

  const setup = (session: object | null, user: object | null) => {
    const auth = {
      verifyAccessToken: jest
        .fn<(token: unknown) => Promise<typeof payload>>()
        .mockResolvedValue(payload),
      getSession: jest
        .fn<(tokenPayload: typeof payload) => Promise<object | null>>()
        .mockResolvedValue(session),
    }
    const users = {
      read: {
        findById: jest
          .fn<(id: string, projection: object) => Promise<object | null>>()
          .mockResolvedValue(user),
      },
    }
    const service = new CollectionAuthService(
      auth as unknown as AuthService,
      users as unknown as UserRepository,
    )
    return { auth, users, service }
  }

  it("проверяет сессию из токена и возвращает идентификатор найденного пользователя", async () => {
    const { auth, users, service } = setup({}, { _id: userId })
    const setContext = jest.spyOn(requestContext, "set")

    await expect(service.authenticate("token")).resolves.toEqual(userId)
    expect(auth.verifyAccessToken).toHaveBeenCalledWith("token")
    expect(auth.getSession).toHaveBeenCalledWith(payload)
    expect(users.read.findById).toHaveBeenCalledWith(payload.sub, { _id: 1 })
    expect(setContext).toHaveBeenCalledWith("userId", payload.sub)
  })

  it.each([
    { session: null, user: { _id: userId } },
    { session: {}, user: null },
  ])(
    "отклоняет запрос без активной сессии или пользователя: %j",
    async ({ session, user }) => {
      const { service } = setup(session, user)

      await expect(service.authenticate("token")).rejects.toThrow(
        UnauthorizedException,
      )
    },
  )

  it("не обращается к сессиям и пользователям после отклонения токена", async () => {
    const { auth, users, service } = setup({}, { _id: userId })
    auth.verifyAccessToken.mockRejectedValueOnce(new UnauthorizedException())

    await expect(service.authenticate("invalid")).rejects.toThrow(
      UnauthorizedException,
    )
    expect(auth.getSession).not.toHaveBeenCalled()
    expect(users.read.findById).not.toHaveBeenCalled()
  })
})
