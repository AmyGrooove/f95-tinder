interface IAuthPrincipal {
  id: string

  sessionId?: string
  roles?: readonly string[]
}

export type { IAuthPrincipal }
