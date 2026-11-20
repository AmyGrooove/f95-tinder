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

@Injectable()
class RecommendationsBodyInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler<unknown>) {
    const { body, headers } = context
      .switchToHttp()
      .getRequest<FastifyRequest>()

    const contentType = headers["content-type"]
      ?.split(";")[0]
      .trim()
      .toLowerCase()
    if (contentType !== "application/json") {
      throw new UnsupportedMediaTypeException(
        DICTIONARY.recommendation.invalidContentType,
      )
    }

    if (!isObject(body) || isArray(body)) {
      throw new BadRequestException(DICTIONARY.recommendation.bodyRequired)
    }

    return next.handle()
  }
}

export { RecommendationsBodyInterceptor }
