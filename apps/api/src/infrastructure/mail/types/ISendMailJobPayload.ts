import type { ISendMailOptions } from "./ISendMailOptions"
import type { ISerializedMailAttachment } from "./ISerializedMailAttachment"

interface ISendMailJobPayload extends Omit<ISendMailOptions, "attachments"> {
  attachments?: ISerializedMailAttachment[]
}

export type { ISendMailJobPayload }
