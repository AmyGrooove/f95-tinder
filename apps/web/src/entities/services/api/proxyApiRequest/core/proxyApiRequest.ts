import { isEmptyString } from '@shared/functions/checks/isEmptyString'
import { isNil } from '@shared/functions/checks/isNil'
import { ENV } from '@shared/static/ENV'

import { createProxyHeaders } from '../functions/createProxyHeaders'

import type { IApiProxyContext } from '../types/IApiProxyContext'

const proxyApiRequest = async (
  request: Request,
  context: IApiProxyContext,
): Promise<Response> => {
  if (isNil(ENV.API_URL) || isEmptyString(ENV.API_URL)) {
    return Response.json(
      { message: 'API proxy is not configured' },
      { status: 502 },
    )
  }

  try {
    const { path } = await context.params
    const normalizedApiUrl = ENV.API_URL.endsWith('/')
      ? ENV.API_URL
      : `${ENV.API_URL}/`
    const encodedPath = path.map((pathSegment) => {
      return encodeURIComponent(pathSegment)
    })
    const upstreamUrl = new URL(encodedPath.join('/'), normalizedApiUrl)
    const requestUrl = new URL(request.url)

    upstreamUrl.search = requestUrl.search

    const requestHeaders = createProxyHeaders(request.headers)

    requestHeaders.delete('content-length')
    requestHeaders.delete('host')
    requestHeaders.set('accept-encoding', 'identity')

    const isRequestWithBody =
      request.method !== 'GET' && request.method !== 'HEAD'
    const requestBody = isRequestWithBody
      ? await request.arrayBuffer()
      : undefined
    const upstreamResponse = await fetch(upstreamUrl, {
      body: requestBody,
      cache: 'no-store',
      headers: requestHeaders,
      method: request.method,
      redirect: 'manual',
      signal: request.signal,
    })
    const responseHeaders = createProxyHeaders(upstreamResponse.headers)

    return new Response(upstreamResponse.body, {
      headers: responseHeaders,
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
    })
  } catch (error) {
    console.error('API proxy request failed', error)

    return Response.json(
      { message: 'API service is unavailable' },
      { status: 502 },
    )
  }
}

export { proxyApiRequest }
