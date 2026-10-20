import type { ISessionOwnerProps } from "./ISessionOwnerProps"

interface IUpdateSessionRefreshTokenProps extends ISessionOwnerProps {
  refreshToken: string

  currentRefreshToken?: string
}

export type { IUpdateSessionRefreshTokenProps }
