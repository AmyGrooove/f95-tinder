import { BadRequestException, Injectable } from "@nestjs/common"
import type {
  CallHandler,
  ExecutionContext,
  NestInterceptor,
} from "@nestjs/common"
import type { FastifyRequest } from "fastify"

import { DICTIONARY } from "@entities/shared/static/DICTIONARY"
import { isArray } from "@shared/functions/checks/isArray"
import { isObject } from "@shared/functions/checks/isObject"

@Injectable()
class LibraryQueryRequestInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler<unknown>) {
    const { body, headers, query } = context
      .switchToHttp()
      .getRequest<FastifyRequest>()

    if (
      headers["content-type"]?.split(";")[0]?.trim().toLowerCase() !==
        "application/json" ||
      !isObject(body) ||
      isArray(body)
    ) {
      throw new BadRequestException(DICTIONARY.user.library.bodyRequired)
    }

    if (isObject(query) && Object.keys(query).length > 0) {
      throw new BadRequestException(DICTIONARY.user.library.queryNotAllowed)
    }

    return next.handle()
  }
}

export { LibraryQueryRequestInterceptor }
