interface IGetSessionResponse {
  displayName: string
  email: string
  id: string
  lastLoginAt: string | null
  role: 'admin' | 'user'
  status: 'active' | 'blocked'
}

export type { IGetSessionResponse }
