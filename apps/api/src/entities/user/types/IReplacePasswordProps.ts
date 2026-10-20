import type { Types } from "mongoose"

interface IReplacePasswordProps {
  userId: Types.ObjectId
  email: string
  currentPasswordHash: string
  passwordHash: string
}

export type { IReplacePasswordProps }
