import { applyDecorators, SetMetadata, UseInterceptors } from "@nestjs/common"

import { ImageUploadInterceptor } from "@infrastructure/storage/services/imageUploadInterceptor"
import { IMAGE_UPLOAD_METADATA_KEY } from "../../../static/IMAGE_UPLOAD_METADATA_KEY"
import type { IImageUploadOptions } from "../../../types/IImageUploadOptions"

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
