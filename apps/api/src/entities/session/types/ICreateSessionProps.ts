import type { Types } from "mongoose"
import type { ECountry } from "@entities/shared/schemas/ECountry"

interface ICreateSessionProps {
  id: Types.ObjectId
  userId: Types.ObjectId
  refreshToken: string

  userAgent?: string
  country?: ECountry
}

export type { ICreateSessionProps }
