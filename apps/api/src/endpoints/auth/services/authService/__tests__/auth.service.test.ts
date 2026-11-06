import { describe, expect, it, jest } from "@jest/globals"
import { UnauthorizedException } from "@nestjs/common"
import { Types } from "mongoose"

import type { SecurityJwtService } from "@infrastructure/security/services/jwtService"
import type { MongoTransactionService } from "@infrastructure/database/services/mongoTransactionService"
import type { UserRepository } from "@entities/user/services/userRepository"
import type { UserSessionRepository } from "@entities/userSession/services/userSessionRepository"

import { AuthService } from "../core/auth.service"

describe("AuthService", () => {
  const sub = new Types.ObjectId().toHexString()
  const sessionId = new Types.ObjectId().toHexString()

  const setup = () => {
    const jwt = { verifyAccessToken: jest.fn(async () => ({ sub, sessionId })) }
    const sessions = {
      findActive:
        jest.fn<UserSessionRepository["findActive"]>(),
    }
    const service = new AuthService(
      {} as UserRepository,
      sessions as unknown as UserSessionRepository,
      {} as MongoTransactionService,
      jwt as unknown as SecurityJwtService,
    )
    return { jwt, sessions, service }
  }

  it.each([null, undefined, "", 42])(
    "отклоняет токен %p до проверки подписи",
    async (token) => {
      const { jwt, service } = setup()
      await expect(service.verifyAccessToken(token)).rejects.toThrow(
        UnauthorizedException,
      )
      expect(jwt.verifyAccessToken).not.toHaveBeenCalled()
    },
  )

  it.each([
    { sub: "bad", sessionId },
    { sub, sessionId: "bad" },
  ])(
    "отклоняет подписанный токен с некорректным идентификатором: %j",
    async (payload) => {
      const { jwt, service } = setup()
      jwt.verifyAccessToken.mockResolvedValueOnce(payload)
      await expect(service.verifyAccessToken("signed")).rejects.toThrow(
        UnauthorizedException,
      )
    },
  )

  it("ищет активную сессию одновременно по идентификатору сессии и её владельцу", async () => {
    const { sessions, service } = setup()
    const payload = await service.verifyAccessToken("signed")

    expect(payload).toMatchObject({ sub, sessionId })
    await service.getSession(payload)
    expect(sessions.findActive).toHaveBeenCalledWith({
      id: new Types.ObjectId(sessionId),
      userId: new Types.ObjectId(sub),
    })
  })
})
