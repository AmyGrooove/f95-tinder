import type { IMailAttachment } from "./IMailAttachment"

interface ISerializedMailAttachment extends Omit<IMailAttachment, "content"> {
  content: string
  isBuffer: boolean
}

export type { ISerializedMailAttachment }
