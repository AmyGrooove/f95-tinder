import { PROXY_HEADER_NAMES } from '../static/PROXY_HEADER_NAMES'

const createProxyHeaders = (sourceHeaders: Headers): Headers => {
  const proxyHeaders = new Headers(sourceHeaders)

  PROXY_HEADER_NAMES.forEach((headerName) => {
    proxyHeaders.delete(headerName)
  })

  return proxyHeaders
}

export { createProxyHeaders }
