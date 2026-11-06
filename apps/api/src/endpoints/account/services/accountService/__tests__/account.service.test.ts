import { describe, expect, it, jest } from "@jest/globals"
import { ConflictException, UnauthorizedException } from "@nestjs/common"
import { mongo, Types } from "mongoose"

import type { MongoTransactionService } from "@infrastructure/database/services/mongoTransactionService"
import type { AuthService } from "@endpoints/auth/services/authService"
import type { UserSessionRepository } from "@entities/userSession/services/userSessionRepository"
import type { UserRepository } from "@entities/user/services/userRepository"

import { AccountService } from "../core/account.service"

describe("AccountService", () => {
  const sub = new Types.ObjectId().toHexString()

  const setup = () => {
    const users = {
      write: {
        updateById: jest
          .fn<
            (
              id: string,
              update: object,
              options: object,
            ) => Promise<object | null>
          >()
          .mockResolvedValue({ _id: new Types.ObjectId(sub) }),
      },
    }
    const auth = {
      verifyAccessToken: jest.fn(async () => ({ sub })),
      getSession: jest.fn<() => Promise<object | null>>().mockResolvedValue({}),
    }
    const service = new AccountService(
      users as unknown as UserRepository,
      {} as UserSessionRepository,
      auth as unknown as AuthService,
      {} as MongoTransactionService,
    )
    return { users, auth, service }
  }

  it("меняет имя только у пользователя из токена", async () => {
    const { users, service } = setup()

    await service.updateUsername("token", { username: "orbit" })
    expect(users.write.updateById).toHaveBeenCalledWith(
      sub,
      { $set: { username: "orbit" } },
      { projection: { _id: 1 } },
    )
  })

  it("не записывает имя после отзыва сессии", async () => {
    const { auth, users, service } = setup()
    auth.getSession.mockResolvedValueOnce(null)

    await expect(
      service.updateUsername("token", { username: "orbit" }),
    ).rejects.toThrow(UnauthorizedException)
    expect(users.write.updateById).not.toHaveBeenCalled()
  })

  it("преобразует конфликт уникальности username в 409", async () => {
    const { users, service } = setup()
    const duplicate = new mongo.MongoServerError({
      code: 11000,
      message: "duplicate username",
      keyPattern: { username: 1 },
    })
    users.write.updateById.mockRejectedValueOnce(duplicate)

    await expect(
      service.updateUsername("token", { username: "orbit" }),
    ).rejects.toThrow(ConflictException)
  })

  it("сохраняет исходную ошибку записи при конфликте другого поля", async () => {
    const { users, service } = setup()
    const duplicate = new mongo.MongoServerError({
      code: 11000,
      message: "duplicate email",
      keyPattern: { email: 1 },
    })
    users.write.updateById.mockRejectedValueOnce(duplicate)

    await expect(
      service.updateUsername("token", { username: "orbit" }),
    ).rejects.toBe(duplicate)
  })
})
