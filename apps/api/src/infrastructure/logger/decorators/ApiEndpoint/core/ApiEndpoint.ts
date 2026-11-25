import { applyDecorators } from "@nestjs/common"
import {
  ApiBearerAuth,
  ApiExtension,
  ApiOperation,
  ApiResponse,
} from "@nestjs/swagger"

import type { IApiEndpointOptions } from "../types/IApiEndpointOptions"
import { API_ENDPOINT_TAGS_EXTENSION } from "../static/API_ENDPOINT_TAGS_EXTENSION"
import { SWAGGER_RESPONSE_HEADERS } from "../static/SWAGGER_RESPONSE_HEADERS"
import { isNil } from "@shared/functions/checks/isNil"
import { HTTP_STATUS_ERROR_CODES } from "../../AppExceptionFilter"
import { SWAGGER_DICTIONARY } from "@shared/static/SWAGGER_DICTIONARY"

const ApiEndpoint = (options: IApiEndpointOptions) => {
  const {
    operationId,
    summary,
    description,
    tags,
    response,
    errors = [],
    auth,
  } = options
  const tagNames = tags?.map((tag) =>
    typeof tag === "string" ? tag : tag.name,
  )
  const tagDefinitions = tags?.filter((tag) => typeof tag !== "string")
  const hasRateLimit = errors.some(({ status }) => status === 429)
  const documentedErrors = errors.some(({ status }) => status === 500)
    ? errors
    : [
        ...errors,
        { status: 500, description: SWAGGER_DICTIONARY.internalError },
      ]

  const decorators = [
    ApiOperation({
      operationId,
      summary,
      description,
      tags: tagNames && [...new Set(tagNames)],
    }),
    ApiResponse({
      ...response,
      headers: hasRateLimit
        ? { ...SWAGGER_RESPONSE_HEADERS.rateLimit, ...response.headers }
        : response.headers,
    }),
    ...documentedErrors.map((error) =>
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
                  example: SWAGGER_DICTIONARY.errorEnvelope.requestIdExample,
                },
              },
            },
          },
        },
        ...error,
        headers:
          error.status === 429
            ? { ...SWAGGER_RESPONSE_HEADERS.retryAfter, ...error.headers }
            : error.headers,
      }),
    ),
  ]

  if (tagDefinitions?.length) {
    decorators.push(ApiExtension(API_ENDPOINT_TAGS_EXTENSION, tagDefinitions))
  }

  if (!isNil(auth)) {
    decorators.push(ApiBearerAuth(auth))
  }

  return applyDecorators(...decorators)
}

export { ApiEndpoint }
