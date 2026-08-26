import { MAIL_JOB_NAME } from "@infrastructure/mail/static/MAIL_JOB_NAME"
import type { ISendMailOptions } from "@infrastructure/mail/types/ISendMailOptions"

interface IJobPayloadMap {
  [MAIL_JOB_NAME]: ISendMailOptions
}

type TJobType = keyof IJobPayloadMap

export type { IJobPayloadMap, TJobType }
