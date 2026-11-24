import type { Types } from "mongoose"
import type { IStorageUploadResult } from "@infrastructure/storage/services/storageService"

interface IReplacePosterProps {
  id: Types.ObjectId
  upload: IStorageUploadResult
}

export type { IReplacePosterProps }
