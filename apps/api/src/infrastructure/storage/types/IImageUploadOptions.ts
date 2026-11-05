import type { FastifyRequest } from "fastify"

interface IImageUploadOptions {
  path: string | ((request: FastifyRequest) => string)

  maxBytes?: number
  maxHeight?: number
  maxPixels?: number
  maxWidth?: number
  quality?: number
  resizeHeight?: number
  resizeWidth?: number
}

export type { IImageUploadOptions }
