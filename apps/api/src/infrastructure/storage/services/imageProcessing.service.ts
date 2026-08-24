import { BadRequestException, Injectable } from "@nestjs/common"
import sharp from "sharp"

import { DEFAULT_IMAGE_QUALITY } from "../static/DEFAULT_IMAGE_QUALITY"
import { SUPPORTED_IMAGE_FORMATS } from "../static/SUPPORTED_IMAGE_FORMATS"
import { SUPPORTED_IMAGE_MIME_TYPES } from "../static/SUPPORTED_IMAGE_MIME_TYPES"
import type { IProcessImageOptions } from "../types/IProcessImageOptions"

@Injectable()
class ImageProcessingService {
  async processImage(
    input: Buffer,
    declaredMimeType: string,
    options: IProcessImageOptions,
  ): Promise<Buffer> {
    if (input.length === 0) {
      throw new BadRequestException("Image upload must not be empty")
    }

    if (!SUPPORTED_IMAGE_MIME_TYPES.includes(declaredMimeType as never)) {
      throw new BadRequestException("Unsupported image MIME type")
    }

    if (input.length > options.maxBytes) {
      throw new BadRequestException("Image upload exceeds the byte limit")
    }

    try {
      const image = sharp(input, {
        failOn: "error",
        limitInputPixels: options.maxPixels,
      }).rotate()
      const metadata = await image.metadata()
      const format = metadata.format
      const width = metadata.width
      const height = metadata.height
      const pages = metadata.pages ?? 1

      if (!SUPPORTED_IMAGE_FORMATS.includes(format as never)) {
        throw new BadRequestException("Unsupported decoded image format")
      }

      const decodedMimeType = format === "jpeg" ? "image/jpeg" : `image/${format}`

      if (decodedMimeType !== declaredMimeType) {
        throw new BadRequestException("Image MIME type does not match decoded content")
      }

      if (!width || !height) {
        throw new BadRequestException("Image dimensions are unavailable")
      }

      if (
        width > options.maxWidth ||
        height > options.maxHeight ||
        width * height * pages > options.maxPixels
      ) {
        throw new BadRequestException("Image dimensions exceed the allowed limit")
      }

      return await image
        .resize({
          width: options.resizeWidth,
          height: options.resizeHeight,
          withoutEnlargement: true,
        })
        .webp({ quality: options.quality ?? DEFAULT_IMAGE_QUALITY })
        .toBuffer()
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error
      }

      throw new BadRequestException("Unable to process the uploaded image")
    }
  }
}

export { ImageProcessingService }
