import type { ISendMailOptions } from "@infrastructure/mail/services/mailService"
import type { ISerializedMailAttachment } from "./ISerializedMailAttachment"

interface ISendMailJobPayload extends Omit<ISendMailOptions, "attachments"> {
  attachments?: ISerializedMailAttachment[]
}

export type { ISendMailJobPayload }
