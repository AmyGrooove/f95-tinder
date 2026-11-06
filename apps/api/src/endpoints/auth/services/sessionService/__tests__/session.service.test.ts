import { describe, expect, it, jest } from "@jest/globals"
import { NotFoundException, UnauthorizedException } from "@nestjs/common"
import { Types } from "mongoose"

import type { AuthService } from "@endpoints/auth/services/authService"
import type { SecurityJwtService } from "@infrastructure/security/services/jwtService"
import type { UserSessionRepository } from "@entities/userSession/services/userSessionRepository"
import type { UserRepository } from "@entities/user/services/userRepository"

import { SessionService } from "../core/session.service"

describe("SessionService", () => {
  const userId = new Types.ObjectId()
  const id = new Types.ObjectId()
  const payload = { sub: userId.toHexString(), sessionId: id.toHexString() }

  const setup = () => {
    const users = { read: { checkIsExists: jest.fn(async () => true) } }
    const sessions = {
      deleteActive: jest
        .fn<
          (filter: {
            id: Types.ObjectId
            userId: Types.ObjectId
          }) => Promise<object | null>
        >()
        .mockResolvedValue({}),
    }
    const auth = {
      verifyAccessToken: jest.fn(async () => payload),
      getSession: jest.fn<() => Promise<object | null>>().mockResolvedValue({}),
    }
    const service = new SessionService(
      users as unknown as UserRepository,
      sessions as unknown as UserSessionRepository,
      {} as SecurityJwtService,
      auth as unknown as AuthService,
    )
    return { users, sessions, auth, service }
  }

  it.each([true, false])(
    "сообщает, удалена ли текущая сессия: %s",
    async (isCurrent) => {
      const { sessions, service } = setup()
      const target = isCurrent ? new Types.ObjectId(id) : new Types.ObjectId()

      await expect(service.deleteSession("token", target)).resolves.toBe(
        isCurrent,
      )
      expect(sessions.deleteActive).toHaveBeenCalledWith({ id: target, userId })
    },
  )

  it("возвращает 404, если у пользователя нет активной целевой сессии", async () => {
    const { sessions, service } = setup()
    sessions.deleteActive.mockResolvedValueOnce(null)

    await expect(
      service.deleteSession("token", new Types.ObjectId()),
    ).rejects.toThrow(NotFoundException)
  })

  it("не удаляет сессию, если текущая уже отозвана", async () => {
    const { auth, sessions, service } = setup()
    auth.getSession.mockResolvedValueOnce(null)

    await expect(service.deleteSession("token", id)).rejects.toThrow(
      UnauthorizedException,
    )
    expect(sessions.deleteActive).not.toHaveBeenCalled()
  })
})
