import { randomInt } from "node:crypto"

import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common"
import { InjectRedis } from "@nestjs-redis/client"
import { mongo, Types } from "mongoose"
import type { RedisClientType } from "redis"

import { AuthService, ConfirmationService } from "@endpoints/auth"

import { DICTIONARY } from "@entities/shared/static/DICTIONARY"
import { UserRepository } from "@entities/user/services/user.repository"
import { InfrastructureConfigService } from "@infrastructure/config/services/config.service"
import { MailService } from "@infrastructure/mail/services/mail.service"
import { LoggerService } from "@infrastructure/logger/services/logger.service"
import { compareHash } from "@infrastructure/security/functions/compareHash"
import { hashValue } from "@infrastructure/security/functions/hashValue"
import { isNil } from "@shared/functions/checks/isNil"
import { isString } from "@shared/functions/checks/isString"
import { requestContext } from "@shared/functions/requestContext"

import type { EmailBodyDto } from "../dto/body/email.body"
import type { ConfirmEmailBodyDto } from "../dto/body/confirmEmail.body"
import { ACCOUNT_CONFIRMATION } from "../static/ACCOUNT_CONFIRMATION"
import type { IAccountEmail } from "../types/IAccountEmail"

@Injectable()
class AccountEmailService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly confirmationService: ConfirmationService,
    private readonly authService: AuthService,
    private readonly mailService: MailService,
    private readonly loggerService: LoggerService,
    private readonly configService: InfrastructureConfigService,
    @InjectRedis("account") private readonly redis: RedisClientType,
  ) {}

  async confirmEmail(accessToken: unknown, body: ConfirmEmailBodyDto) {
    const account = await this.getAccountCredentials(accessToken)
    const pending = await this.consumeEmail(account.userId, body.code)

    try {
      const updatedUser = await this.userRepository.write.updateByFilter(
        {
          _id: new Types.ObjectId(account.userId),
          email: pending.currentEmail,
          passwordHash: pending.passwordHash,
        },
        { $set: { email: pending.email } },
        { projection: { _id: 1 } },
      )

      if (isNil(updatedUser)) {
        throw new BadRequestException(
          DICTIONARY.account.emailConfirmationInvalid,
        )
      }
    } catch (error) {
      if (
        error instanceof mongo.MongoServerError &&
        error.code === 11000 &&
        error.keyPattern?.email === 1
      ) {
        throw new ConflictException(DICTIONARY.account.emailTaken)
      }

      throw error
    }
  }

  async requestEmail(accessToken: unknown, body: EmailBodyDto) {
    const account = await this.getAccountCredentials(accessToken)
    const isPasswordValid = await compareHash(
      body.currentPassword,
      account.passwordHash,
    )

    if (!isPasswordValid) {
      throw new UnauthorizedException(DICTIONARY.account.invalidPassword)
    }

    const isEmailTaken = await this.userRepository.read.checkIsExists({
      email: body.email,
    })

    if (isEmailTaken) {
      throw new ConflictException(DICTIONARY.account.emailTaken)
    }

    const key = `${this.configService.app.name}:account:email:{${account.userId}}`
    const cooldownKey = `${key}:cooldown`

    if ((await this.redis.exists(cooldownKey)) !== 0) {
      throw new HttpException(
        DICTIONARY.account.emailResendTooSoon,
        HttpStatus.TOO_MANY_REQUESTS,
      )
    }

    const code = randomInt(1_000_000).toString().padStart(6, "0")
    const codeHash = await hashValue(code)
    const pending = JSON.stringify({
      userId: account.userId,
      email: body.email,
      currentEmail: account.email,
      passwordHash: account.passwordHash,
      codeHash,
      attemptsRemaining: ACCOUNT_CONFIRMATION.attempts,
    } satisfies IAccountEmail)
    const saved = await this.redis.eval(ACCOUNT_CONFIRMATION.saveScript, {
      keys: [key, cooldownKey],
      arguments: [
        pending,
        String(ACCOUNT_CONFIRMATION.expirationSeconds),
        String(ACCOUNT_CONFIRMATION.resendSeconds),
      ],
    })

    if (saved !== 1) {
      throw new HttpException(
        DICTIONARY.account.emailResendTooSoon,
        HttpStatus.TOO_MANY_REQUESTS,
      )
    }

    try {
      await this.mailService.send({
        to: body.email,
        subject: DICTIONARY.account.emailMailSubject,
        text: `${DICTIONARY.account.emailMailText} ${code}\n${DICTIONARY.account.emailMailExpiration}`,
      })
    } catch (error) {
      try {
        await this.redis.eval(ACCOUNT_CONFIRMATION.discardScript, {
          keys: [key, cooldownKey],
          arguments: [pending],
        })
      } catch (cleanupError) {
        this.loggerService.error(
          DICTIONARY.account.emailCleanupFailed,
          cleanupError,
        )
      }

      throw new ServiceUnavailableException(
        DICTIONARY.account.emailMailUnavailable,
        { cause: error },
      )
    }
  }

  private consumeEmail(userId: string, code: string): Promise<IAccountEmail> {
    return this.confirmationService.consume({
      redis: this.redis,
      key: `${this.configService.app.name}:account:email:{${userId}}`,
      code,
      attempts: ACCOUNT_CONFIRMATION.attempts,
      invalidMessage: DICTIONARY.account.emailConfirmationInvalid,
      checkIsPending: (pending): pending is IAccountEmail => {
        return (
          pending.userId === userId &&
          "email" in pending &&
          isString(pending.email) &&
          "currentEmail" in pending &&
          isString(pending.currentEmail) &&
          "passwordHash" in pending &&
          isString(pending.passwordHash)
        )
      },
    })
  }

  private async getAccountCredentials(accessToken: unknown) {
    const payload = await this.authService.verifyAccessToken(accessToken)
    const [session, user] = await Promise.all([
      this.authService.getSession(payload),
      this.userRepository.read.findById(payload.sub, {
        _id: 1,
        email: 1,
        passwordHash: 1,
      }),
    ])

    if (isNil(session) || isNil(user)) {
      throw new UnauthorizedException(DICTIONARY.auth.unauthorized)
    }

    requestContext.set("userId", payload.sub)

    if (isNil(user.passwordHash) || isNil(user.email)) {
      throw new ConflictException(DICTIONARY.account.emailUnavailable)
    }

    return {
      userId: payload.sub,
      email: user.email,
      passwordHash: user.passwordHash,
    }
  }
}

export { AccountEmailService }
