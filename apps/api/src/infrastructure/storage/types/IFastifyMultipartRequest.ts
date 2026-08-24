import type { FastifyRequest } from "fastify"

import type { IFastifyMultipartFile } from "./IFastifyMultipartFile"
import type { TProcessedUpload } from "./TProcessedUpload"

interface IFastifyMultipartRequest extends FastifyRequest {
  body: Record<string, unknown>
  processedUploads?: Record<string, TProcessedUpload>
  parts?: () => AsyncIterableIterator<IFastifyMultipartFile | unknown>
}

export type { IFastifyMultipartRequest }
