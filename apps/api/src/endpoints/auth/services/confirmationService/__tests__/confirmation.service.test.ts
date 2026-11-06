import { describe, expect, it, jest } from "@jest/globals"
import type { RedisClientType } from "redis"

import { hashValue } from "@infrastructure/security/functions/hashValue"

import { ConfirmationService } from "../core/confirmation.service"
import { CONFIRMATION_SCRIPT } from "../static/CONFIRMATION_SCRIPT"
import type { IConfirmation } from "../types/IConfirmation"

describe("ConfirmationService", () => {
  const service = new ConfirmationService()
  const key = "confirmation:test"
  const invalidMessage = "Неверный код"

  const setup = (raw: string | null, result = 0) => {
    const redis = {
      get: jest.fn(async () => raw),
      eval: jest.fn<RedisClientType["eval"]>().mockResolvedValue(result),
    }
    const props = {
      redis: redis as unknown as RedisClientType,
      key,
      code: "123456",
      attempts: 3,
      invalidMessage,
      checkIsPending: (pending: IConfirmation): pending is IConfirmation =>
        pending.userId === "owner",
    }

    return { redis, props }
  }

  it.each([
    null,
    "{",
    "{}",
    JSON.stringify({ userId: "owner", codeHash: "hash", attemptsRemaining: 0 }),
    JSON.stringify({ userId: "owner", codeHash: "hash", attemptsRemaining: 4 }),
    JSON.stringify({ userId: "other", codeHash: "hash", attemptsRemaining: 3 }),
  ])(
    "отклоняет отсутствующую или некорректную заявку %p без изменения Redis",
    async (raw) => {
      const { redis, props } = setup(raw)
      await expect(service.consume(props)).rejects.toMatchObject({
        status: 400,
        message: invalidMessage,
      })
      expect(redis.eval).not.toHaveBeenCalled()
    },
  )

  it.each([
    { code: "123456", result: 1, validFlag: "1" },
    { code: "123456", result: 0, validFlag: "1" },
    { code: "654321", result: 0, validFlag: "0" },
  ])(
    "подтверждает заявку только при успешном атомарном списании: %j",
    async ({ code, result, validFlag }) => {
      const pending = {
        userId: "owner",
        codeHash: await hashValue("123456"),
        attemptsRemaining: 2,
      }
      const { redis, props } = setup(JSON.stringify(pending), result)
      const confirmation = service.consume({ ...props, code })

      if (result === 1) {
        await expect(confirmation).resolves.toEqual(pending)
      } else {
        await expect(confirmation).rejects.toMatchObject({
          status: 400,
          message: invalidMessage,
        })
      }

      expect(redis.eval).toHaveBeenCalledWith(CONFIRMATION_SCRIPT, {
        keys: [key],
        arguments: [pending.codeHash, pending.userId, validFlag],
      })
    },
  )
})
