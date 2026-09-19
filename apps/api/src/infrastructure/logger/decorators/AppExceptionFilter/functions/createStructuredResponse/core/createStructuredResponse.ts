import { HttpException } from "@nestjs/common"

import { isArray } from "@shared/functions/checks/isArray"
import { isNil } from "@shared/functions/checks/isNil"
import { isObject } from "@shared/functions/checks/isObject"
import { ERROR_MESSAGES } from "@shared/static/ERROR_MESSAGES"

import { getExplicitStructuredResponse } from "../functions/getExplicitStructuredResponse"
import { getHttpExceptionMessage } from "../functions/getHttpExceptionMessage"
import { ERROR_CODES } from "../../../static/ERROR_CODES"
import { HTTP_STATUS_ERROR_CODES } from "../../../static/HTTP_STATUS_ERROR_CODES"
import type { IStructuredExceptionResponse } from "../../../types/IStructuredExceptionResponse"

const createStructuredResponse = (
  exception: unknown,
  statusCode: number,
): IStructuredExceptionResponse => {
  if (!(exception instanceof HttpException)) {
    return {
      code: ERROR_CODES.INTERNAL_ERROR,
      message: ERROR_MESSAGES.INTERNAL_ERROR,
      details: null,
    }
  }

  const exceptionResponse = exception.getResponse()

  if (isObject(exceptionResponse)) {
    const structuredResponse = getExplicitStructuredResponse(exceptionResponse)

    if (!isNil(structuredResponse)) {
      return structuredResponse
    }

    if ("message" in exceptionResponse && isArray(exceptionResponse.message)) {
      return {
        code: ERROR_CODES.BAD_REQUEST,
        message: ERROR_MESSAGES.VALIDATION_ERROR,
        details: { errors: exceptionResponse.message },
      }
    }
  }

  return {
    code:
      HTTP_STATUS_ERROR_CODES[statusCode] ?? (`HTTP_${statusCode}` as const),
    message: getHttpExceptionMessage(exceptionResponse, exception.message),
    details: null,
  }
}

export { createStructuredResponse }
