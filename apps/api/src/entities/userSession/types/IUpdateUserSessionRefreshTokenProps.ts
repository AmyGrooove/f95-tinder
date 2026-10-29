import type { IUserSessionOwnerProps } from "./IUserSessionOwnerProps"

interface IUpdateUserSessionRefreshTokenProps extends IUserSessionOwnerProps {
  refreshToken: string

  currentRefreshToken?: string
}

export type { IUpdateUserSessionRefreshTokenProps }
