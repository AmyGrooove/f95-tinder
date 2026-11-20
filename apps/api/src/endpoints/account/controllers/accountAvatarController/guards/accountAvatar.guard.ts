import { BadRequestException, Injectable } from "@nestjs/common"
import type { CanActivate, ExecutionContext } from "@nestjs/common"

import { AccountAvatarService } from "@endpoints/account/services/accountAvatarService"
import { DICTIONARY } from "@shared/static/DICTIONARY"

import type { IAccountAvatarRequest } from "../types/IAccountAvatarRequest"

@Injectable()
class AccountAvatarGuard implements CanActivate {
  constructor(private readonly avatarService: AccountAvatarService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<IAccountAvatarRequest>()
    const accessToken = /(?:^|;\s*)__Host-accessToken=([^;]*)/.exec(
      request.headers.cookie ?? "",
    )?.[1]
    request.avatarOwnerId = await this.avatarService.authenticate(accessToken)

    if (request.method === "PUT" && !request.isMultipart()) {
      throw new BadRequestException(DICTIONARY.image.missingField("avatar"))
    }

    return true
  }
}

export { AccountAvatarGuard }
