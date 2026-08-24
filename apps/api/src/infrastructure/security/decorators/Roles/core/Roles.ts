import { SetMetadata } from "@nestjs/common"

import { ROLES_METADATA_KEY } from "../static/ROLES_METADATA_KEY"

const Roles = (
  ...roles: readonly string[]
): ClassDecorator & MethodDecorator => {
  return SetMetadata(ROLES_METADATA_KEY, roles)
}

export { Roles }
