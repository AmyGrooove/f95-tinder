import { BadRequestException, Injectable } from "@nestjs/common"
import type {
  CallHandler,
  ExecutionContext,
  NestInterceptor,
} from "@nestjs/common"

import { DICTIONARY } from "@entities/shared/static/DICTIONARY"
import { isArray } from "@shared/functions/checks/isArray"
import { isObject } from "@shared/functions/checks/isObject"

@Injectable()
class SearchBodyInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler<unknown>) {
    const { body } = context.switchToHttp().getRequest<{ body: unknown }>()

    if (!isObject(body) || isArray(body)) {
      throw new BadRequestException(DICTIONARY.search.bodyRequired)
    }

    return next.handle()
  }
}

export { SearchBodyInterceptor }
