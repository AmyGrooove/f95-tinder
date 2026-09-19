interface IStorageUploadResult {
  path: string
  size: number
  mimeType: string

  publicUrl?: string
}

export type { IStorageUploadResult }
