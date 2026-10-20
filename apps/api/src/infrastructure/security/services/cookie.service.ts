import { Injectable, type CookieSerializeOptions } from "@nestjs/common"
import { HttpAdapterHost } from "@nestjs/core"

import { JWT_ACCESS_EXPIRATION } from "../static/JWT_ACCESS_EXPIRATION"
import { JWT_REFRESH_EXPIRATION } from "../static/JWT_REFRESH_EXPIRATION"
import type { IAuthTokens } from "../types/IAuthTokens"

@Injectable()
class SecurityCookieService {
  constructor(private readonly adapterHost: HttpAdapterHost) {}

  setAuthCookies(reply: unknown, tokens: IAuthTokens) {
    const cookieOptions = {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      path: "/",
    } satisfies CookieSerializeOptions

    this.adapterHost.httpAdapter.setCookie(
      reply,
      "__Host-accessToken",
      tokens.accessToken,
      {
        ...cookieOptions,
        maxAge: JWT_ACCESS_EXPIRATION,
      },
    )

    this.adapterHost.httpAdapter.setCookie(
      reply,
      "__Host-refreshToken",
      tokens.refreshToken,
      {
        ...cookieOptions,
        maxAge: JWT_REFRESH_EXPIRATION,
      },
    )
  }
}

export { SecurityCookieService }
