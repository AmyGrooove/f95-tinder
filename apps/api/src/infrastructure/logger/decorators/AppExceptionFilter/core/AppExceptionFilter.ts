import { ArgumentsHost, Catch, HttpException, HttpStatus } from "@nestjs/common"
import { BaseExceptionFilter } from "@nestjs/core"
import type { FastifyReply, FastifyRequest } from "fastify"

import { LoggerService } from "../../../services/logger.service"
import { createStructuredResponse } from "../functions/createStructuredResponse"
import type { IErrorEnvelope } from "../types/IErrorEnvelope"
import { DICTIONARY } from "@shared/static/DICTIONARY"

@Catch()
class AppExceptionFilter extends BaseExceptionFilter {
  constructor(private readonly loggerService: LoggerService) {
    super()
  }

  catch(exception: unknown, host: ArgumentsHost) {
    const httpContext = host.switchToHttp()
    const request = httpContext.getRequest<FastifyRequest>()
    const response = httpContext.getResponse<FastifyReply>()
    const statusCode = this.getStatusCode(exception)
    const requestId = request.id
    const structuredResponse = createStructuredResponse(exception, statusCode)
    const body: IErrorEnvelope = {
      error: {
        code: structuredResponse.code,
        message: structuredResponse.message,
        details: structuredResponse.details,
        requestId,
      },
    }

    if (statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.loggerService.error(
        DICTIONARY.logger.unhandledException,
        exception,
        {
          context: AppExceptionFilter.name,
          requestId,
        },
      )
    }

    response.status(statusCode).send(body)
  }

  private getStatusCode(exception: unknown) {
    if (exception instanceof HttpException) {
      return exception.getStatus()
    }

    return HttpStatus.INTERNAL_SERVER_ERROR
  }
}

export { AppExceptionFilter }
