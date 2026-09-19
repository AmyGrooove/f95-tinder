import {
  BadRequestException,
  Injectable,
  PayloadTooLargeException,
} from "@nestjs/common"
import type { CallHandler, ExecutionContext, NestInterceptor } from "@nestjs/common"
import { Reflector } from "@nestjs/core"
import type { Observable } from "rxjs"

import { isArray } from "@shared/functions/checks/isArray"

import { normalizeMultipartFields } from "../functions/normalizeMultipartFields"
import { ImageProcessingService } from "../services/imageProcessing.service"
import { StorageService } from "../services/storage.service"
import { DEFAULT_IMAGE_QUALITY } from "../static/DEFAULT_IMAGE_QUALITY"
import type { IFastifyMultipartFile } from "../types/IFastifyMultipartFile"
import type { IFastifyMultipartRequest } from "../types/IFastifyMultipartRequest"
import type { IImageUploadOptions } from "../types/IImageUploadOptions"
import type { IProcessImageOptions } from "../types/IProcessImageOptions"

const IMAGE_UPLOAD_METADATA_KEY = "infrastructure:storage:image-upload"

@Injectable()
class ImageUploadInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly imageProcessingService: ImageProcessingService,
    private readonly storageService: StorageService,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    const metadata = this.reflector.getAllAndOverride<{
      field: string
      options: IImageUploadOptions
    }>(IMAGE_UPLOAD_METADATA_KEY, [context.getHandler(), context.getClass()])

    if (!metadata) {
      return next.handle()
    }

    const request = context.switchToHttp().getRequest<IFastifyMultipartRequest>()

    if (!request.parts) {
      throw new BadRequestException("Multipart support is not registered")
    }

    const multipartFields: Record<string, unknown> = {}
    let uploadedFile: IFastifyMultipartFile | undefined

    for await (const part of request.parts()) {
      if (this.isMultipartFile(part)) {
        if (uploadedFile || part.fieldname !== metadata.field) {
          part.file.resume()
          throw new BadRequestException("Exactly one image file is required")
        }

        uploadedFile = part
        continue
      }

      if (this.isMultipartField(part)) {
        const previousValue = multipartFields[part.fieldname]

        if (previousValue === undefined) {
          multipartFields[part.fieldname] = part.value
          continue
        }

        multipartFields[part.fieldname] = isArray(previousValue)
          ? [...previousValue, part.value]
          : [previousValue, part.value]
      }
    }

    if (!uploadedFile) {
      throw new BadRequestException(`Missing image field '${metadata.field}'`)
    }

    const processingOptions = this.createProcessingOptions(metadata.options)
    const input = await this.readFile(uploadedFile, processingOptions.maxBytes)
    const output = await this.imageProcessingService.processImage(
      input,
      uploadedFile.mimetype,
      processingOptions,
    )
    const processedUpload = await this.storageService.upload(
      metadata.options.path,
      output,
      "image/webp",
    )

    request.body = Object.assign(
      {},
      request.body ?? {},
      normalizeMultipartFields(multipartFields),
    )
    request.processedUploads = { [metadata.field]: processedUpload }

    return next.handle()
  }

  private createProcessingOptions(
    options: IImageUploadOptions,
  ): IProcessImageOptions {
    return {
      maxBytes: options.maxBytes ?? 5 * 1024 * 1024,
      maxHeight: options.maxHeight ?? 4_000,
      maxPixels: options.maxPixels ?? 16_000_000,
      maxWidth: options.maxWidth ?? 4_000,
      quality: options.quality ?? DEFAULT_IMAGE_QUALITY,
      resizeHeight: options.resizeHeight,
      resizeWidth: options.resizeWidth,
    }
  }

  private async readFile(
    file: IFastifyMultipartFile,
    maxBytes: number,
  ): Promise<Buffer> {
    const chunks: Buffer[] = []
    let size = 0

    try {
      for await (const chunk of file.file) {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
        size += buffer.length

        if (size > maxBytes) {
          throw new PayloadTooLargeException("Image upload exceeds the byte limit")
        }

        chunks.push(buffer)
      }

      return Buffer.concat(chunks, size)
    } finally {
      file.file.resume()
    }
  }

  private isMultipartFile(part: unknown): part is IFastifyMultipartFile {
    return (
      typeof part === "object" &&
      part !== null &&
      "type" in part &&
      part.type === "file" &&
      "file" in part &&
      "fieldname" in part
    )
  }

  private isMultipartField(
    part: unknown,
  ): part is { fieldname: string; value: unknown } {
    return (
      typeof part === "object" &&
      part !== null &&
      "fieldname" in part &&
      "value" in part &&
      typeof part.fieldname === "string"
    )
  }
}

export { ImageUploadInterceptor }
