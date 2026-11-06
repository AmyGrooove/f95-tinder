import { describe, expect, it, jest } from "@jest/globals"
import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from "@nestjs/common"
import { Types } from "mongoose"
import type { RedisClientType } from "redis"

import type { InfrastructureConfigService } from "@infrastructure/config/services/configService"
import type { LoggerService } from "@infrastructure/logger/services/loggerService"
import type { MailService } from "@infrastructure/mail/services/mailService"
import type { AuthService } from "@endpoints/auth/services/authService"
import type { ConfirmationService } from "@endpoints/auth/services/confirmationService"
import type { UserRepository } from "@entities/user/services/userRepository"

import { AccountEmailService } from "../core/accountEmail.service"

describe("AccountEmailService", () => {
  const userId = new Types.ObjectId()
  const pending = {
    userId: userId.toHexString(),
    currentEmail: "old@example.com",
    email: "new@example.com",
    passwordHash: "old-hash",
  }

  const setup = (
    user: { email: string | null; passwordHash: string | null },
    session: object | null = {},
  ) => {
    const users = {
      read: { findById: jest.fn(async () => user) },
      write: {
        updateByFilter: jest
          .fn<
            (
              filter: object,
              update: object,
              options: object,
            ) => Promise<{ _id: Types.ObjectId } | null>
          >()
          .mockResolvedValue({ _id: userId }),
      },
    }
    const confirmation = { consume: jest.fn(async () => pending) }
    const auth = {
      verifyAccessToken: jest.fn(async () => ({ sub: userId.toHexString() })),
      getSession: jest.fn(async () => session),
    }
    const service = new AccountEmailService(
      users as unknown as UserRepository,
      confirmation as unknown as ConfirmationService,
      auth as unknown as AuthService,
      {} as MailService,
      {} as LoggerService,
      { app: { name: "bisky" } } as InfrastructureConfigService,
      {} as RedisClientType,
    )
    return { users, confirmation, service }
  }

  it("отклоняет подтверждение без активной сессии до списания кода", async () => {
    const { confirmation, service } = setup(
      { email: "old@example.com", passwordHash: "old-hash" },
      null,
    )

    await expect(
      service.confirmEmail("token", { code: "123456" }),
    ).rejects.toThrow(UnauthorizedException)
    expect(confirmation.consume).not.toHaveBeenCalled()
  })

  it("отклоняет подтверждение для неподходящего состояния аккаунта", async () => {
    const { confirmation, service } = setup({ email: null, passwordHash: null })

    await expect(
      service.confirmEmail("token", { code: "123456" }),
    ).rejects.toThrow(ConflictException)
    expect(confirmation.consume).not.toHaveBeenCalled()
  })

  it("привязывает запись к исходным учётным данным и отклоняет потерю совпадения", async () => {
    const { users, service } = setup({
      email: "old@example.com",
      passwordHash: "old-hash",
    })
    users.write.updateByFilter.mockResolvedValueOnce(null)

    await expect(
      service.confirmEmail("token", { code: "123456" }),
    ).rejects.toThrow(BadRequestException)
    expect(users.write.updateByFilter).toHaveBeenCalledWith(
      { _id: userId, email: "old@example.com", passwordHash: "old-hash" },
      { $set: { email: "new@example.com" } },
      { projection: { _id: 1 } },
    )
  })
})
