import type { Types } from "mongoose"

interface IUserSessionOwnerProps {
  id: Types.ObjectId
  userId: Types.ObjectId
}

export type { IUserSessionOwnerProps }
