interface IMailAttachment {
  content: Buffer | string
  filename: string

  contentType?: string
}

export type { IMailAttachment }
