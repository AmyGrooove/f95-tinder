interface IAccessTokenPayload {
  sub: string
  sessionId: string
  role: string
  type: "access"
}

export type { IAccessTokenPayload }
