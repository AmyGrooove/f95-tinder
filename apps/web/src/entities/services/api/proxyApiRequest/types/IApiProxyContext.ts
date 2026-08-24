interface IApiProxyContext {
  params: Promise<{
    path: string[]
  }>
}

export type { IApiProxyContext }
