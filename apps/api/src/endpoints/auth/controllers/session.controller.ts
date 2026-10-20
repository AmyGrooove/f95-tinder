import {
  Controller,
  Cookies,
  Get,
  Header,
  HttpCode,
  Patch,
  Res,
} from "@nestjs/common"
import { ApiCookieAuth, ApiTags } from "@nestjs/swagger"

import { ApiEndpoint } from "@infrastructure/logger/decorators/ApiEndpoint"
import { SecurityCookieService } from "@infrastructure/security/services/cookie.service"

import { SessionResponseDto } from "../dto/response/session.response"
import { SessionService } from "../services/session.service"

@ApiTags("Авторизация")
@Controller("auth/session")
class SessionController {
  constructor(
    private readonly sessionService: SessionService,
    private readonly securityCookieService: SecurityCookieService,
  ) {}

  @Get()
  @Header("Cache-Control", "no-store")
  @ApiCookieAuth("accessCookie")
  @ApiEndpoint({
    operationId: "AuthController_getSessions",
    summary: "Получить действующие сессии текущего аккаунта",
    description:
      "Требует действующий JWT в cookie __Host-accessToken и неистёкшую серверную сессию текущего пользователя. Возвращает только его неистёкшие сессии, от новых к старым, с признаком текущей сессии. Токены и их хеши не возвращаются",
    response: {
      status: 200,
      type: SessionResponseDto,
      isArray: true,
      description: "Действующие сессии текущего аккаунта",
    },
    errors: [
      {
        status: 401,
        description: "Авторизация отсутствует или недействительна",
      },
      { status: 429, description: "Превышен лимит запросов" },
    ],
  })
  getSessions(
    @Cookies("__Host-accessToken") accessToken: unknown,
  ): Promise<SessionResponseDto[]> {
    return this.sessionService.getSessions(accessToken)
  }

  @Patch("refresh")
  @HttpCode(204)
  @Header("Cache-Control", "no-store")
  @ApiCookieAuth("refreshCookie")
  @ApiEndpoint({
    operationId: "AuthController_refresh",
    summary: "Обновить токены и продлить текущую сессию",
    description:
      "Без тела запроса и access-токена. Требует действующий refresh JWT в cookie __Host-refreshToken и соответствующую неистёкшую серверную сессию. Старый refresh-токен становится недействительным; при конкурентном обновлении только один запрос успешен, остальные получают 401 без изменения cookies. Для изменяющих запросов действует встроенная CSRF-защита NestJS",
    response: {
      status: 204,
      description: "Токены заменены, текущая сессия продлена на 120 дней",
      headers: {
        "Set-Cookie": {
          description:
            "__Host-accessToken (600 секунд) и __Host-refreshToken (10368000 секунд); Path=/; HttpOnly; Secure; SameSite=Strict",
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
  async refresh(
    @Cookies("__Host-refreshToken") refreshToken: unknown,
    @Res({ passthrough: true }) reply: unknown,
  ): Promise<void> {
    const tokens = await this.sessionService.refresh(refreshToken)

    this.securityCookieService.setAuthCookies(reply, tokens)
  }
}

export { SessionController }
