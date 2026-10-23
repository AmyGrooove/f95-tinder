import { createParamDecorator, type ExecutionContext } from "@nestjs/common"

import { isNil } from "@shared/functions/checks/isNil"

import type { IAuthPrincipal } from "../../../types/IAuthPrincipal"
import type { ICurrentUserRequest } from "../../../types/ICurrentUserRequest"

const CurrentUser: {
  (): ParameterDecorator
  <K extends keyof IAuthPrincipal>(field: K): ParameterDecorator
} = createParamDecorator(
  (field: keyof IAuthPrincipal | undefined, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest<ICurrentUserRequest>()
    const authPrincipal = request.authPrincipal

    if (isNil(field)) {
      return authPrincipal
    }

    return authPrincipal?.[field]
  },
)

export { CurrentUser }
