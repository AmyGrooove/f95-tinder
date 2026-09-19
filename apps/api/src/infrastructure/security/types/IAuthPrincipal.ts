interface IAuthPrincipal {
  id: string
  sessionId: string
  roles: string[]
}

export type { IAuthPrincipal }
