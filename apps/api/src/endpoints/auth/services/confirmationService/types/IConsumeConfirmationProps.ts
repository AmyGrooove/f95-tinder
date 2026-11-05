import type { RedisClientType } from "redis"

import type { IConfirmation } from "./IConfirmation"

interface IConsumeConfirmationProps<TPending extends IConfirmation> {
  redis: RedisClientType
  key: string
  code: string
  attempts: number
  invalidMessage: string
  checkIsPending: (pending: IConfirmation) => pending is TPending
}

export type { IConsumeConfirmationProps }
