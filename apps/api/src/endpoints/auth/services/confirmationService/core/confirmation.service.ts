import { BadRequestException, Injectable } from "@nestjs/common"

import { compareHash } from "@infrastructure/security/functions/compareHash"
import { isInt } from "@shared/functions/checks/isInt"
import { isNil } from "@shared/functions/checks/isNil"
import { isObject } from "@shared/functions/checks/isObject"
import { isString } from "@shared/functions/checks/isString"

import { CONFIRMATION_SCRIPT } from "../static/CONFIRMATION_SCRIPT"
import type { IConfirmation } from "../types/IConfirmation"
import type { IConsumeConfirmationProps } from "../types/IConsumeConfirmationProps"

@Injectable()
class ConfirmationService {
  async consume<TPending extends IConfirmation>(
    props: IConsumeConfirmationProps<TPending>,
  ): Promise<TPending> {
    const { redis, key, code, attempts, invalidMessage, checkIsPending } = props
    const raw = await redis.get(key)

    if (isNil(raw)) {
      throw new BadRequestException(invalidMessage)
    }

    let pending: unknown

    try {
      pending = JSON.parse(raw)
    } catch (error) {
      throw new BadRequestException(invalidMessage, { cause: error })
    }

    if (
      !this.checkIsConfirmation(pending) ||
      pending.attemptsRemaining <= 0 ||
      pending.attemptsRemaining > attempts ||
      !checkIsPending(pending)
    ) {
      throw new BadRequestException(invalidMessage)
    }

    const isCodeValid = await compareHash(code, pending.codeHash)
    const consumed = await redis.eval(CONFIRMATION_SCRIPT, {
      keys: [key],
      arguments: [pending.codeHash, pending.userId, isCodeValid ? "1" : "0"],
    })

    if (consumed !== 1) {
      throw new BadRequestException(invalidMessage)
    }

    return pending
  }

  private checkIsConfirmation(value: unknown): value is IConfirmation {
    return (
      isObject(value) &&
      "userId" in value &&
      isString(value.userId) &&
      "codeHash" in value &&
      isString(value.codeHash) &&
      "attemptsRemaining" in value &&
      isInt(value.attemptsRemaining)
    )
  }
}

export { ConfirmationService }
