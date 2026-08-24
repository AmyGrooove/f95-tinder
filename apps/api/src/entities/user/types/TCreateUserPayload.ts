import type { Types } from "mongoose"

import type { TUserRole } from "../schemas/userRole.schema"
import type { TUserStatus } from "../schemas/userStatus.schema"

type TCreateUserPayload = {
  _id: Types.ObjectId
  email: string
  passwordHash: string
  displayName: string
  role: TUserRole
  status: TUserStatus
  lastLoginAt: Date | null
}

export type { TCreateUserPayload }
