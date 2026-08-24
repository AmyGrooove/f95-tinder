import { createParamDecorator, type ExecutionContext } from "@nestjs/common"

import type { IFastifyMultipartRequest } from "../types/IFastifyMultipartRequest"

const UploadedImage = createParamDecorator(
  (field: string | undefined, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest<IFastifyMultipartRequest>()

    if (!field) {
      return request.processedUploads
    }

    return request.processedUploads?.[field]
  },
)

export { UploadedImage }
