import type { ClientSession, Types } from "mongoose"

interface ICreateAuthSessionProps {
  userId: Types.ObjectId
  role: string

  userAgent?: string
  session?: ClientSession
}

export type { ICreateAuthSessionProps }
