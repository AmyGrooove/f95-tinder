import type { Types } from "mongoose"
import type { ECountry } from "@entities/shared/schemas/ECountry"

interface ICreateUserSessionProps {
  id: Types.ObjectId
  userId: Types.ObjectId
  refreshToken: string

  userAgent?: string
  country?: ECountry
}

export type { ICreateUserSessionProps }
