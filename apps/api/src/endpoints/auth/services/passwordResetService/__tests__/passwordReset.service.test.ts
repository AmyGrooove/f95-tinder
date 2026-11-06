import { describe, expect, it, jest } from "@jest/globals"

import { PasswordResetService } from "../core/passwordReset.service"
import { PASSWORD_RESET } from "../static/PASSWORD_RESET"
import type { RedisClientType } from "redis"
import type { UserRepository } from "@entities/user/services/userRepository"
import type { ConfirmationService } from "@endpoints/auth/services/confirmationService"
import type { UserSessionRepository } from "@entities/userSession/services/userSessionRepository"
import type { MongoTransactionService } from "@infrastructure/database/services/mongoTransactionService"
import type { MailService } from "@infrastructure/mail/services/mailService"
import type { InfrastructureConfigService } from "@infrastructure/config/services/configService"
import type { LoggerService } from "@infrastructure/logger/services/loggerService"

describe("PasswordResetService", () => {
  const email = "unknown@example.com"

  const setup = (cooldown: number) => {
    const users = { read: { findOne: jest.fn(async () => null) } }
    const mail = { send: jest.fn() }
    const redis = {
      exists: jest.fn(async () => cooldown),
      eval: jest.fn<RedisClientType["eval"]>().mockResolvedValue(1),
    }
    const service = new PasswordResetService(
      users as unknown as UserRepository,
      {} as ConfirmationService,
      {} as UserSessionRepository,
      {} as MongoTransactionService,
      mail as unknown as MailService,
      { app: { name: "bisky" } } as InfrastructureConfigService,
      {} as LoggerService,
      redis as unknown as RedisClientType,
    )
    return { users, mail, redis, service }
  }

  it("во время паузы завершает запрос без поиска пользователя и отправки письма", async () => {
    const { users, mail, redis, service } = setup(1)

    await expect(service.requestReset({ email })).resolves.toBeUndefined()
    expect(users.read.findOne).not.toHaveBeenCalled()
    expect(redis.eval).not.toHaveBeenCalled()
    expect(mail.send).not.toHaveBeenCalled()
  })

  it("для неизвестного email ставит паузу без записи подтверждения и отправки письма", async () => {
    const { mail, redis, service } = setup(0)

    await expect(service.requestReset({ email })).resolves.toBeUndefined()
    expect(redis.eval).toHaveBeenCalledWith(PASSWORD_RESET.saveScript, {
      keys: [
        expect.stringMatching(/^bisky:auth:passwordReset:\{[a-f0-9]{64}\}$/),
        expect.stringMatching(/:cooldown$/),
      ],
      arguments: [
        "",
        String(PASSWORD_RESET.expirationSeconds),
        String(PASSWORD_RESET.resendSeconds),
      ],
    })
    expect(mail.send).not.toHaveBeenCalled()
  })
})
