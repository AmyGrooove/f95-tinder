import { applyDecorators, SetMetadata, UseInterceptors } from "@nestjs/common"

import { ImageUploadInterceptor } from "../interceptors/imageUpload.interceptor"
import type { IImageUploadOptions } from "../types/IImageUploadOptions"

const IMAGE_UPLOAD_METADATA_KEY = "infrastructure:storage:image-upload"

const ImageUpload = (
  field: string,
  options: IImageUploadOptions,
): MethodDecorator => {
  return applyDecorators(
    SetMetadata(IMAGE_UPLOAD_METADATA_KEY, { field, options }),
    UseInterceptors(ImageUploadInterceptor),
  )
}

export { ImageUpload }
