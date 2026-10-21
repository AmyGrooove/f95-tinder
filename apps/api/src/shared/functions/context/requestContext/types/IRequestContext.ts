interface IRequestContext {
  requestId: string
  method: string
  path: string
  [key: string]: unknown
}

export type { IRequestContext }
