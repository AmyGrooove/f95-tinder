import type { IMailAttachment } from "./IMailAttachment"
import type { TMailSender } from "./TMailSender"

interface ISendMailOptions {
  subject: string
  to: string | string[]

  attachments?: IMailAttachment[]
  from?: TMailSender
  html?: string
  idempotencyKey?: string
  replyTo?: string | string[]
  text?: string
}

export type { ISendMailOptions }
