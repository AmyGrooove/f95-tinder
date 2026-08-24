import type { IMailAttachment } from "./IMailAttachment"

interface ISendMailOptions {
  subject: string
  to: string | string[]

  attachments?: IMailAttachment[]
  from?: string
  html?: string
  replyTo?: string | string[]
  text?: string
}

export type { ISendMailOptions }
