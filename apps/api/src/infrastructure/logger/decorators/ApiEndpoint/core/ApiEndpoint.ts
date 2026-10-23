import { applyDecorators } from "@nestjs/common"
import { ApiBearerAuth, ApiOperation, ApiResponse } from "@nestjs/swagger"

import type { IApiEndpointOptions } from "../types/IApiEndpointOptions"
import { isNil } from "@shared/functions/checks/isNil"
import { HTTP_STATUS_ERROR_CODES } from "../../AppExceptionFilter"
import { SWAGGER_DICTIONARY } from "@shared/static/SWAGGER_DICTIONARY"

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
    ...errors.map((error) =>
      ApiResponse({
        schema: {
          type: "object",
          required: ["error"],
          properties: {
            error: {
              type: "object",
              required: ["code", "message", "details", "requestId"],
              properties: {
                code: {
                  type: "string",
                  description: SWAGGER_DICTIONARY.errorEnvelope.code,
                  example:
                    HTTP_STATUS_ERROR_CODES[Number(error.status)] ??
                    `HTTP_${error.status ?? 500}`,
                },
                message: {
                  type: "string",
                  description: SWAGGER_DICTIONARY.errorEnvelope.message,
                  example: SWAGGER_DICTIONARY.errorEnvelope.messageExample,
                },
                details: {
                  type: "object",
                  nullable: true,
                  additionalProperties: true,
                  description: SWAGGER_DICTIONARY.errorEnvelope.details,
                  example: null,
                },
                requestId: {
                  type: "string",
                  description: SWAGGER_DICTIONARY.errorEnvelope.requestId,
                  example: "req-1",
                },
              },
            },
          },
        },
        ...error,
      }),
    ),
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
