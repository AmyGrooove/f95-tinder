interface IRefreshTokenPayload {
  sub: string
  sessionId: string
  type: "refresh"
}

export type { IRefreshTokenPayload }
