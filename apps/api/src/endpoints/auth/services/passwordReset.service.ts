import { createHash, randomInt } from "node:crypto"

import { BadRequestException, Injectable } from "@nestjs/common"
import { InjectRedis } from "@nestjs-redis/client"
import { isObjectIdOrHexString, Types } from "mongoose"
import type { RedisClientType } from "redis"

import { DICTIONARY } from "@entities/shared/static/DICTIONARY"
import { SessionRepository } from "@entities/session/services/session.repository"
import { UserRepository } from "@entities/user/services/user.repository"
import { InfrastructureConfigService } from "@infrastructure/config/services/config.service"
import { MongoTransactionService } from "@infrastructure/database/services/mongoTransaction.service"
import { LoggerService } from "@infrastructure/logger/services/logger.service"
import { MailService } from "@infrastructure/mail/services/mail.service"
import { hashValue } from "@infrastructure/security/functions/hashValue"
import { isNil } from "@shared/functions/checks/isNil"
import { isString } from "@shared/functions/checks/isString"
import { requestContext } from "@shared/functions/requestContext"

import type { PasswordResetBodyDto } from "../dto/body/passwordReset.body"
import type { ConfirmPasswordResetBodyDto } from "../dto/body/confirmPasswordReset.body"
import { PASSWORD_RESET } from "../static/PASSWORD_RESET"
import { ConfirmationService } from "./confirmation.service"
import type { IPasswordReset } from "../types/IPasswordReset"

@Injectable()
class PasswordResetService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly confirmationService: ConfirmationService,
    private readonly sessionRepository: SessionRepository,
    private readonly transactionService: MongoTransactionService,
    private readonly mailService: MailService,
    private readonly configService: InfrastructureConfigService,
    private readonly loggerService: LoggerService,
    @InjectRedis("auth") private readonly redis: RedisClientType,
  ) {}

  async confirmReset(body: ConfirmPasswordResetBodyDto) {
    const pending = await this.consumeReset(body.email, body.code)
    const passwordHash = await hashValue(body.newPassword)
    const userId = new Types.ObjectId(pending.userId)

    await this.transactionService.run(async (session) => {
      const user = await this.userRepository.replacePassword(
        {
          userId,
          email: pending.email,
          currentPasswordHash: pending.passwordHash,
          passwordHash,
        },
        { session },
      )

      if (isNil(user)) {
        throw new BadRequestException(
          DICTIONARY.auth.passwordResetConfirmationInvalid,
        )
      }

      await this.sessionRepository.deleteByUser(userId, { session })
    })

    requestContext.set("userId", pending.userId)
  }

  async requestReset(body: PasswordResetBodyDto) {
    const emailHash = createHash("sha256").update(body.email).digest("hex")
    const key = `${this.configService.app.name}:auth:passwordReset:{${emailHash}}`
    const cooldownKey = `${key}:cooldown`

    if ((await this.redis.exists(cooldownKey)) !== 0) {
      return
    }

    const code = randomInt(1_000_000).toString().padStart(6, "0")
    const [user, codeHash] = await Promise.all([
      this.userRepository.read.findOne(
        { email: body.email },
        { _id: 1, email: 1, passwordHash: 1 },
      ),
      hashValue(code),
    ])
    const pending =
      isNil(user) || isNil(user.email) || isNil(user.passwordHash)
        ? ""
        : JSON.stringify({
            userId: user._id.toString(),
            email: user.email,
            passwordHash: user.passwordHash,
            codeHash,
            attemptsRemaining: PASSWORD_RESET.attempts,
          } satisfies IPasswordReset)
    const saved = await this.redis.eval(PASSWORD_RESET.saveScript, {
      keys: [key, cooldownKey],
      arguments: [
        pending,
        String(PASSWORD_RESET.expirationSeconds),
        String(PASSWORD_RESET.resendSeconds),
      ],
    })

    if (saved !== 1 || pending === "") {
      return
    }

    try {
      await this.mailService.send({
        to: body.email,
        subject: DICTIONARY.auth.passwordResetMailSubject,
        text: `${DICTIONARY.auth.passwordResetMailText} ${code}\n${DICTIONARY.auth.passwordResetMailExpiration}`,
      })
    } catch (error) {
      this.loggerService.error(
        DICTIONARY.auth.passwordResetMailUnavailable,
        error,
      )

      try {
        await this.redis.eval(PASSWORD_RESET.discardScript, {
          keys: [key],
          arguments: [codeHash],
        })
      } catch (cleanupError) {
        this.loggerService.error(
          DICTIONARY.auth.passwordResetCleanupFailed,
          cleanupError,
        )
      }
    }
  }

  private consumeReset(email: string, code: string): Promise<IPasswordReset> {
    const emailHash = createHash("sha256").update(email).digest("hex")

    return this.confirmationService.consume({
      redis: this.redis,
      key: `${this.configService.app.name}:auth:passwordReset:{${emailHash}}`,
      code,
      attempts: PASSWORD_RESET.attempts,
      invalidMessage: DICTIONARY.auth.passwordResetConfirmationInvalid,
      checkIsPending: (pending): pending is IPasswordReset => {
        return (
          isObjectIdOrHexString(pending.userId) &&
          "email" in pending &&
          pending.email === email &&
          "passwordHash" in pending &&
          isString(pending.passwordHash)
        )
      },
    })
  }
}

export { PasswordResetService }
