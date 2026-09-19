import type { FastifyRequest } from "fastify"

import type { IStorageUploadResult } from "./IStorageUploadResult"

interface IFastifyMultipartRequest extends FastifyRequest {
  body: Record<string, unknown>
  processedUploads?: Record<string, IStorageUploadResult>
}

export type { IFastifyMultipartRequest }
