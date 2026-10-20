import { createHash, randomInt } from "node:crypto"

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
import { hashValue } from "@infrastructure/security/functions/hashValue"
import { isNil } from "@shared/functions/checks/isNil"
import { isString } from "@shared/functions/checks/isString"
import { requestContext } from "@shared/functions/requestContext"

import type { SetupBodyDto } from "../dto/body/setup.body"
import type { ConfirmSetupBodyDto } from "../dto/body/confirmSetup.body"
import { ACCOUNT_CONFIRMATION } from "../static/ACCOUNT_CONFIRMATION"
import type { IAccountSetup } from "../types/IAccountSetup"

@Injectable()
class AccountSetupService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly confirmationService: ConfirmationService,
    private readonly authService: AuthService,
    private readonly mailService: MailService,
    private readonly loggerService: LoggerService,
    private readonly configService: InfrastructureConfigService,
    @InjectRedis("account") private readonly redis: RedisClientType,
  ) {}

  async confirmSetup(accessToken: unknown, body: ConfirmSetupBodyDto) {
    const userId = await this.getSetupUserId(accessToken)
    const pending = await this.consumeSetup(userId, body.code)

    try {
      const updatedUser = await this.userRepository.write.updateByFilter(
        {
          _id: new Types.ObjectId(userId),
          email: null,
          passwordHash: null,
          accessCodeHash: pending.accessCodeHash,
        },
        {
          $set: {
            email: pending.email,
            passwordHash: pending.passwordHash,
            accessCodeHash: null,
          },
        },
        { projection: { _id: 1 } },
      )

      if (isNil(updatedUser)) {
        throw new BadRequestException(
          DICTIONARY.account.setupConfirmationInvalid,
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

  async requestSetup(accessToken: unknown, body: SetupBodyDto) {
    const userId = await this.getSetupUserId(accessToken)
    const accessCodeHash = createHash("sha256")
      .update(body.accessCode)
      .digest("hex")
    const isCredentialsMatch = await this.userRepository.read.checkIsExists({
      _id: new Types.ObjectId(userId),
      accessCodeHash,
      passwordHash: null,
      email: null,
    })

    if (!isCredentialsMatch) {
      throw new UnauthorizedException(DICTIONARY.auth.invalidCredentials)
    }

    const isEmailTaken = await this.userRepository.read.checkIsExists({
      email: body.email,
    })

    if (isEmailTaken) {
      throw new ConflictException(DICTIONARY.account.emailTaken)
    }

    const key = `${this.configService.app.name}:account:setup:{${userId}}`
    const cooldownKey = `${key}:cooldown`

    if ((await this.redis.exists(cooldownKey)) !== 0) {
      throw new HttpException(
        DICTIONARY.account.setupResendTooSoon,
        HttpStatus.TOO_MANY_REQUESTS,
      )
    }

    const code = randomInt(1_000_000).toString().padStart(6, "0")
    const [passwordHash, codeHash] = await Promise.all([
      hashValue(body.password),
      hashValue(code),
    ])
    const pending = JSON.stringify({
      userId,
      email: body.email,
      passwordHash,
      accessCodeHash,
      codeHash,
      attemptsRemaining: ACCOUNT_CONFIRMATION.attempts,
    } satisfies IAccountSetup)
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
        DICTIONARY.account.setupResendTooSoon,
        HttpStatus.TOO_MANY_REQUESTS,
      )
    }

    try {
      await this.mailService.send({
        to: body.email,
        subject: DICTIONARY.account.setupMailSubject,
        text: `${DICTIONARY.account.setupMailText} ${code}\n${DICTIONARY.account.setupMailExpiration}`,
      })
    } catch (error) {
      try {
        await this.redis.eval(ACCOUNT_CONFIRMATION.discardScript, {
          keys: [key, cooldownKey],
          arguments: [pending],
        })
      } catch (cleanupError) {
        this.loggerService.error(
          DICTIONARY.account.setupCleanupFailed,
          cleanupError,
        )
      }

      throw new ServiceUnavailableException(
        DICTIONARY.account.setupMailUnavailable,
        { cause: error },
      )
    }
  }

  private consumeSetup(userId: string, code: string): Promise<IAccountSetup> {
    return this.confirmationService.consume({
      redis: this.redis,
      key: `${this.configService.app.name}:account:setup:{${userId}}`,
      code,
      attempts: ACCOUNT_CONFIRMATION.attempts,
      invalidMessage: DICTIONARY.account.setupConfirmationInvalid,
      checkIsPending: (pending): pending is IAccountSetup => {
        return (
          pending.userId === userId &&
          "email" in pending &&
          isString(pending.email) &&
          "passwordHash" in pending &&
          isString(pending.passwordHash) &&
          "accessCodeHash" in pending &&
          isString(pending.accessCodeHash)
        )
      },
    })
  }

  private async getSetupUserId(accessToken: unknown) {
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

    if (!isNil(user.passwordHash) || !isNil(user.email)) {
      throw new ConflictException(DICTIONARY.account.setupUnavailable)
    }

    return payload.sub
  }
}

export { AccountSetupService }
