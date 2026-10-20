import { applyDecorators } from "@nestjs/common"
import { ApiBearerAuth, ApiOperation, ApiResponse } from "@nestjs/swagger"

import type { IApiEndpointOptions } from "../types/IApiEndpointOptions"
import { isNil } from "@shared/functions/checks/isNil"

const ApiEndpoint = (options: IApiEndpointOptions) => {
  const {
    operationId,
    summary,
    description,
    response,
    errors = [],
    auth,
  } = options

  const decorators = [
    ApiOperation({ operationId, summary, description }),
    ...errors.map((error) => ApiResponse(error)),
  ]

  if (!isNil(response)) {
    decorators.push(ApiResponse(response))
  }

  if (!isNil(auth)) {
    decorators.push(ApiBearerAuth(auth))
  }

  return applyDecorators(...decorators)
}

export { ApiEndpoint }
