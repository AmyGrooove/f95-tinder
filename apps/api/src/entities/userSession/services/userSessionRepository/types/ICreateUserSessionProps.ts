import type { ECountry } from "@entities/shared/schemas/ECountry"

import type { IUserSessionOwnerProps } from "./IUserSessionOwnerProps"

interface ICreateUserSessionProps extends IUserSessionOwnerProps {
  refreshToken: string

  userAgent?: string
  country?: ECountry
}

export type { ICreateUserSessionProps }
