interface IAccessTokenPayload {
  sub: string
  sessionId: string
  roles: string[]
  type: "access"
}

export type { IAccessTokenPayload }
