type TJwtClaims = {
  sub: string

  sessionId?: string
  roles?: readonly string[]
}

export type { TJwtClaims }
