import type { FastifyRequest } from "fastify"

import type { IStorageUploadResult } from "@infrastructure/storage/services/storageService"

interface IFastifyMultipartRequest extends FastifyRequest {
  body: Record<string, unknown>
  processedUploads?: Record<string, IStorageUploadResult>
}

export type { IFastifyMultipartRequest }
