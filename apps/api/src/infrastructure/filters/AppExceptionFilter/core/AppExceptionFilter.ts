import { ArgumentsHost, Catch, HttpException, HttpStatus } from "@nestjs/common"
import { BaseExceptionFilter } from "@nestjs/core"
import type { FastifyReply, FastifyRequest } from "fastify"

import { redactLogValue } from "@infrastructure/logger/functions/redactLogValue"
import { AppLoggerService } from "@infrastructure/logger/services/appLogger.service"
import { isArray } from "@shared/functions/isArray"
import { isNil } from "@shared/functions/isNil"
import { isObject } from "@shared/functions/isObject"
import { isString } from "@shared/functions/isString"
import { ERROR_MESSAGES } from "@shared/static/ERROR_MESSAGES"

import { isErrorCode } from "../functions/isErrorCode"
import { ERROR_CODES } from "../static/ERROR_CODES"
import type { IErrorEnvelope } from "../types/IErrorEnvelope"
import type { IStructuredExceptionResponse } from "../types/IStructuredExceptionResponse"
import type { TErrorCode } from "../types/TErrorCode"

@Catch()
class AppExceptionFilter extends BaseExceptionFilter {
  constructor(private readonly appLoggerService: AppLoggerService) {
    super()
  }

  catch(exception: unknown, host: ArgumentsHost) {
    const httpContext = host.switchToHttp()
    const request = httpContext.getRequest<FastifyRequest>()
    const response = httpContext.getResponse<FastifyReply>()
    const statusCode = this.getStatusCode(exception)
    const traceId = request.id
    const structuredResponse = this.createStructuredResponse(
      exception,
      statusCode,
    )
    const body: IErrorEnvelope = {
      error: {
        code: structuredResponse.code,
        message: structuredResponse.message,
        details: structuredResponse.details,
        traceId,
      },
    }

    if (!(exception instanceof HttpException)) {
      this.appLoggerService.error("Unhandled exception", exception, {
        context: AppExceptionFilter.name,
        requestId: traceId,
        method: request.method,
        url: request.url,
      })
    }

    response.status(statusCode).send(body)
  }

  private getStatusCode(exception: unknown) {
    if (exception instanceof HttpException) {
      return exception.getStatus()
    }

    return HttpStatus.INTERNAL_SERVER_ERROR
  }

  private createStructuredResponse(
    exception: unknown,
    statusCode: number,
  ): IStructuredExceptionResponse {
    if (!(exception instanceof HttpException)) {
      return {
        code: ERROR_CODES.INTERNAL_ERROR,
        message: ERROR_MESSAGES.INTERNAL_ERROR,
        details: null,
      }
    }

    const exceptionResponse = exception.getResponse()

    if (isObject(exceptionResponse)) {
      const structuredResponse =
        this.getExplicitStructuredResponse(exceptionResponse)

      if (!isNil(structuredResponse)) {
        return structuredResponse
      }

      const validationDetails = this.getValidationDetails(exceptionResponse)

      if (!isNil(validationDetails)) {
        return {
          code: ERROR_CODES.BAD_REQUEST,
          message: ERROR_MESSAGES.VALIDATION_ERROR,
          details: validationDetails,
        }
      }
    }

    return {
      code: this.getHttpErrorCode(statusCode),
      message: this.getHttpExceptionMessage(
        exceptionResponse,
        exception.message,
      ),
      details: null,
    }
  }

  private getExplicitStructuredResponse(
    response: object,
  ): IStructuredExceptionResponse | undefined {
    if (!("code" in response) || !("message" in response)) {
      return undefined
    }

    const { code, message } = response

    if (!isErrorCode(code) || !isString(message)) {
      return undefined
    }

    const details = "details" in response ? response.details : null

    if (isNil(details)) {
      return {
        code,
        message,
        details: null,
      }
    }

    if (isArray(details)) {
      const redactedDetails = redactLogValue(details)

      return {
        code,
        message,
        details: isArray(redactedDetails) ? redactedDetails : null,
      }
    }

    if (isObject(details)) {
      const redactedDetails = redactLogValue(details)

      return {
        code,
        message,
        details: isObject(redactedDetails)
          ? Object.fromEntries(Object.entries(redactedDetails))
          : null,
      }
    }

    return {
      code,
      message,
      details: null,
    }
  }

  private getHttpErrorCode(statusCode: number): TErrorCode {
    if (statusCode === HttpStatus.BAD_REQUEST) {
      return ERROR_CODES.BAD_REQUEST
    }

    if (statusCode === HttpStatus.UNAUTHORIZED) {
      return ERROR_CODES.UNAUTHORIZED
    }

    if (statusCode === HttpStatus.FORBIDDEN) {
      return ERROR_CODES.FORBIDDEN
    }

    if (statusCode === HttpStatus.NOT_FOUND) {
      return ERROR_CODES.NOT_FOUND
    }

    if (statusCode === HttpStatus.TOO_MANY_REQUESTS) {
      return ERROR_CODES.TOO_MANY_REQUESTS
    }

    return ERROR_CODES.INTERNAL_ERROR
  }

  private getValidationDetails(response: object) {
    if (!("message" in response)) {
      return undefined
    }

    const { message } = response

    if (!isArray(message)) {
      return undefined
    }

    const redactedMessage = redactLogValue(message)

    return isArray(redactedMessage) ? redactedMessage : undefined
  }

  private getHttpExceptionMessage(
    response: unknown,
    fallbackMessage: string,
  ): string {
    if (isString(response)) {
      return response
    }

    if (isObject(response)) {
      if (!("message" in response)) {
        return fallbackMessage
      }

      const { message } = response

      if (isString(message)) {
        return message
      }
    }

    return fallbackMessage
  }
}

export { AppExceptionFilter }
