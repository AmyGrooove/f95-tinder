import type { Types } from "mongoose"

interface ICreateSessionProps {
  id: Types.ObjectId
  userId: Types.ObjectId
  refreshToken: string

  userAgent?: string
}

export type { ICreateSessionProps }
