import { BadRequestException, Injectable } from "@nestjs/common"
import type { CanActivate, ExecutionContext } from "@nestjs/common"
import { Types } from "mongoose"
import type { FastifyRequest } from "fastify"
import { REGEX } from "@shared/static/REGEX"
import { CollectionService } from "@endpoints/collection/services/collectionService"

@Injectable()
class CollectionPosterGuard implements CanActivate {
  constructor(private readonly collectionService: CollectionService) {}

  async canActivate(context: ExecutionContext) {
    const request = context
      .switchToHttp()
      .getRequest<FastifyRequest<{ Params: { id: string } }>>()
    if (
      !REGEX.MONGO_OBJECT_ID.test(request.params.id) ||
      !request.isMultipart()
    ) {
      throw new BadRequestException(
        "Требуются ID подборки и multipart/form-data",
      )
    }
    const accessToken = /(?:^|;\s*)__Host-accessToken=([^;]*)/.exec(
      request.headers.cookie ?? "",
    )?.[1]
    await this.collectionService.getOwnedCollection(
      accessToken,
      new Types.ObjectId(request.params.id),
    )
    return true
  }
}

export { CollectionPosterGuard }
