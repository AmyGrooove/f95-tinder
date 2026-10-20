import type { Types } from "mongoose"

interface ISessionOwnerProps {
  id: Types.ObjectId
  userId: Types.ObjectId
}

export type { ISessionOwnerProps }
