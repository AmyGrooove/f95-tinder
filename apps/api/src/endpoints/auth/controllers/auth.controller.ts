import { Controller, Header, Headers, Post, Res } from "@nestjs/common"
import { ApiTags } from "@nestjs/swagger"
import { Throttle } from "@nestjs/throttler"

import { ApiEndpoint } from "@infrastructure/logger/decorators/ApiEndpoint"
import { SecurityCookieService } from "@infrastructure/security/services/cookie.service"

import { RegisterResponseDto } from "../dto/response/register.response"
import { AuthService } from "../services/auth.service"

@ApiTags("Авторизация")
@Controller("auth")
class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly securityCookieService: SecurityCookieService,
  ) {}

  @Post("register")
  @Header("Cache-Control", "no-store")
  @Throttle({ default: { limit: 2, ttl: 60_000 } })
  @ApiEndpoint({
    operationId: "AuthController_register",
    summary: "Создать аккаунт и открыть сессию",
    description:
      "Без тела запроса и авторизации. JWT выдаются только в HttpOnly Secure cookies с SameSite=Strict. Для браузера требуется HTTPS; действует встроенная CSRF-защита NestJS",
    response: {
      status: 201,
      type: RegisterResponseDto,
      description: "Аккаунт и сессия созданы; секретный код показан один раз",
      headers: {
        "Set-Cookie": {
          description:
            "__Host-accessToken (600 секунд) и __Host-refreshToken (10368000 секунд); Path=/; HttpOnly; Secure; SameSite=Strict",
          schema: { type: "string" },
        },
      },
    },
    errors: [
      { status: 403, description: "Проверка защиты от CSRF не пройдена" },
      { status: 429, description: "Превышен лимит регистрации" },
      { status: 503, description: "Не удалось создать уникальный логин" },
    ],
  })
  async register(
    @Headers("user-agent") userAgent: string | undefined,
    @Res({ passthrough: true }) reply: unknown,
  ): Promise<RegisterResponseDto> {
    const { username, accessCode, accessToken, refreshToken } =
      await this.authService.register(userAgent)

    this.securityCookieService.setAuthCookies(reply, {
      accessToken,
      refreshToken,
    })

    return { username, accessCode }
  }
}

export { AuthController }
