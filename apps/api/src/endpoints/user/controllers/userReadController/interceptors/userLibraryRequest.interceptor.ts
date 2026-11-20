import {
  BadRequestException,
  Injectable,
  UnsupportedMediaTypeException,
} from "@nestjs/common"
import type {
  CallHandler,
  ExecutionContext,
  NestInterceptor,
} from "@nestjs/common"
import type { FastifyRequest } from "fastify"

import { DICTIONARY } from "@entities/shared/static/DICTIONARY"
import { isArray } from "@shared/functions/checks/isArray"
import { isObject } from "@shared/functions/checks/isObject"
import { isUndefined } from "@shared/functions/checks/isUndefined"

@Injectable()
class UserLibraryRequestInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler<unknown>) {
    const { body, headers, query } = context
      .switchToHttp()
      .getRequest<FastifyRequest>()
    const contentType = headers["content-type"]

    if (
      !isUndefined(contentType) &&
      contentType.split(";")[0]?.trim().toLowerCase() !== "application/json"
    ) {
      throw new UnsupportedMediaTypeException(
        DICTIONARY.user.library.unsupportedMediaType,
      )
    }

    if (!isObject(body) || isArray(body)) {
      throw new BadRequestException(DICTIONARY.user.library.bodyRequired)
    }

    if (isObject(query) && Object.keys(query).length > 0) {
      throw new BadRequestException(DICTIONARY.user.library.queryNotAllowed)
    }

    return next.handle()
  }
}

export { UserLibraryRequestInterceptor }
