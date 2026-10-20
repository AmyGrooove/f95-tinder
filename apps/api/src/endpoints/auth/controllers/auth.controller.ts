import {
  Body,
  Controller,
  Cookies,
  Header,
  Headers,
  HttpCode,
  Post,
  Res,
} from "@nestjs/common"
import { ApiCookieAuth, ApiTags } from "@nestjs/swagger"
import { Throttle } from "@nestjs/throttler"

import { ApiEndpoint } from "@infrastructure/logger/decorators/ApiEndpoint"
import { SecurityCookieService } from "@infrastructure/security/services/cookie.service"

import { RegisterResponseDto } from "../dto/response/register.response"
import { LoginCodeBodyDto } from "../dto/body/loginCode.body"
import { AuthService } from "../services/auth.service"

@ApiTags("Авторизация")
@Controller("auth")
class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly securityCookieService: SecurityCookieService,
  ) {}

  @Post("login/code")
  @HttpCode(204)
  @Header("Cache-Control", "no-store")
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiEndpoint({
    operationId: "AuthController_loginByCode",
    summary: "Войти по секретному коду",
    description:
      "Без авторизации. Доступно только до установки пароля. Создаёт новую сессию, сохраняя остальные. JWT выдаются только в HttpOnly Secure cookies с SameSite=Strict. Для браузера требуется HTTPS; действует встроенная CSRF-защита NestJS",
    response: {
      status: 204,
      description: "Сессия создана, токены установлены в auth cookies",
      headers: {
        "Set-Cookie": {
          description:
            "__Host-accessToken (600 секунд) и __Host-refreshToken (10368000 секунд); Path=/; HttpOnly; Secure; SameSite=Strict",
          schema: { type: "string" },
        },
      },
    },
    errors: [
      { status: 400, description: "Некорректные данные запроса" },
      { status: 401, description: "Секретный код недействителен" },
      { status: 403, description: "Проверка защиты от CSRF не пройдена" },
      { status: 429, description: "Превышен лимит попыток входа" },
    ],
  })
  async loginByCode(
    @Body() body: LoginCodeBodyDto,
    @Headers("user-agent") userAgent: string | undefined,
    @Res({ passthrough: true }) reply: unknown,
  ): Promise<void> {
    const tokens = await this.authService.loginByCode(body, userAgent)

    this.securityCookieService.setAuthCookies(reply, tokens)
  }

  @Post("logout")
  @HttpCode(204)
  @Header("Cache-Control", "no-store")
  @ApiCookieAuth("accessCookie")
  @ApiEndpoint({
    operationId: "AuthController_logout",
    summary: "Завершить текущую сессию",
    description:
      "Без тела запроса. Требует действующий JWT в cookie __Host-accessToken и неистёкшую серверную сессию текущего пользователя. Удаляет только текущую сессию и очищает обе auth cookies. При истёкшем access-токене сначала требуется обновление через /auth/session/refresh. Повторный выход из удалённой сессии возвращает 401 без изменения cookies. Действует встроенная CSRF-защита NestJS",
    response: {
      status: 204,
      description: "Текущая сессия завершена, обе auth cookies очищены",
      headers: {
        "Set-Cookie": {
          description:
            "__Host-accessToken и __Host-refreshToken очищены; Path=/; HttpOnly; Secure; SameSite=Strict",
          schema: { type: "string" },
        },
      },
    },
    errors: [
      {
        status: 401,
        description: "Авторизация отсутствует или недействительна",
      },
      { status: 403, description: "Проверка защиты от CSRF не пройдена" },
      { status: 429, description: "Превышен лимит запросов" },
    ],
  })
  async logout(
    @Cookies("__Host-accessToken") accessToken: unknown,
    @Res({ passthrough: true }) reply: unknown,
  ): Promise<void> {
    await this.authService.logout(accessToken)

    this.securityCookieService.clearAuthCookies(reply)
  }

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
