import type { IMailAttachment } from "@infrastructure/mail/services/mailService"

interface ISerializedMailAttachment extends Omit<IMailAttachment, "content"> {
  content: string
  isBuffer: boolean
}

export type { ISerializedMailAttachment }
