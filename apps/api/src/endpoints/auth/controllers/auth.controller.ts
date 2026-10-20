import {
  Body,
  Controller,
  Cookies,
  Header,
  Headers,
  HttpCode,
  Patch,
  Post,
  Res,
} from "@nestjs/common"
import { ApiCookieAuth, ApiTags } from "@nestjs/swagger"
import { Throttle } from "@nestjs/throttler"

import { ApiEndpoint } from "@infrastructure/logger/decorators/ApiEndpoint"
import { SecurityCookieService } from "@infrastructure/security/services/cookie.service"

import { RegisterResponseDto } from "../dto/response/register.response"
import { LoginCodeResponseDto } from "../dto/response/loginCode.response"
import { LoginCodeBodyDto } from "../dto/body/loginCode.body"
import { LoginBodyDto } from "../dto/body/login.body"
import { AuthService } from "../services/auth.service"
import { PasswordResetBodyDto } from "../dto/body/passwordReset.body"
import { PasswordResetService } from "../services/passwordReset.service"
import { ConfirmPasswordResetBodyDto } from "../dto/body/confirmPasswordReset.body"

@ApiTags("Авторизация")
@Controller("auth")
class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly securityCookieService: SecurityCookieService,
    private readonly passwordResetService: PasswordResetService,
  ) {}

  @Patch("password/reset")
  @HttpCode(204)
  @Header("Cache-Control", "no-store")
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiEndpoint({
    operationId: "AuthController_confirmPasswordReset",
    summary: "Подтвердить сброс пароля",
    description:
      "Без авторизации. Принимает email, шестизначный код из письма и новый пароль. Код действует 4 часа и отменяется после 3 неверных попыток. Успешная проверка погашает код однократно. Изменение email или пароля после запроса делает подтверждение недействительным. Новый пароль и завершение всех сессий применяются одной транзакцией; для продолжения нужен новый вход. При ошибке применения погашенный код не восстанавливается, требуется новый запрос. Действует встроенная CSRF-защита NestJS",
    response: {
      status: 204,
      description: "Пароль изменён, все сессии завершены, auth cookies очищены",
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
        status: 400,
        description:
          "Некорректные данные запроса или недействительный код сброса",
      },
      { status: 403, description: "Проверка защиты от CSRF не пройдена" },
      {
        status: 429,
        description: "Превышен лимит подтверждений сброса пароля",
      },
    ],
  })
  async confirmPasswordReset(
    @Body() body: ConfirmPasswordResetBodyDto,
    @Res({ passthrough: true }) reply: unknown,
  ) {
    await this.passwordResetService.confirmReset(body)

    this.securityCookieService.clearAuthCookies(reply)
  }

  @Post("password/reset")
  @HttpCode(204)
  @Header("Cache-Control", "no-store")
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiEndpoint({
    operationId: "AuthController_requestPasswordReset",
    summary: "Запросить код сброса пароля",
    description:
      "Без авторизации. При наличии аккаунта с подтверждённым email и установленным паролем отправляет шестизначный код. Код действует 4 часа, допускает 3 неверные попытки; новый код отменяет предыдущий. Повторная отправка доступна через минуту. Ответ одинаков для неизвестного email, аккаунта без пароля, запроса во время ожидания повторной отправки и ошибки постановки письма в очередь. Действует встроенная CSRF-защита NestJS",
    response: {
      status: 204,
      description: "Запрос обработан без раскрытия существования аккаунта",
    },
    errors: [
      { status: 400, description: "Некорректные данные запроса" },
      { status: 403, description: "Проверка защиты от CSRF не пройдена" },
      { status: 429, description: "Превышен лимит запросов сброса пароля" },
    ],
  })
  async requestPasswordReset(@Body() body: PasswordResetBodyDto) {
    await this.passwordResetService.requestReset(body)
  }

  @Post("login")
  @HttpCode(204)
  @Header("Cache-Control", "no-store")
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiEndpoint({
    operationId: "AuthController_login",
    summary: "Войти по логину и паролю",
    description:
      "Без авторизации. Доступно после первоначальной настройки аккаунта. Создаёт новую сессию, сохраняя остальные. JWT выдаются только в HttpOnly Secure cookies с SameSite=Strict. Для браузера требуется HTTPS; действует встроенная CSRF-защита NestJS",
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
      { status: 401, description: "Логин или пароль недействительны" },
      { status: 403, description: "Проверка защиты от CSRF не пройдена" },
      { status: 429, description: "Превышен лимит попыток входа" },
    ],
  })
  async login(
    @Body() body: LoginBodyDto,
    @Headers("user-agent") userAgent: string | undefined,
    @Res({ passthrough: true }) reply: unknown,
  ) {
    const tokens = await this.authService.login(body, userAgent)

    this.securityCookieService.setAuthCookies(reply, tokens)
  }

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
  ) {
    const tokens = await this.authService.loginByCode(body, userAgent)

    this.securityCookieService.setAuthCookies(reply, tokens)
  }

  @Patch("login/code")
  @HttpCode(200)
  @Header("Cache-Control", "no-store")
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiCookieAuth("accessCookie")
  @ApiEndpoint({
    operationId: "AuthController_reissueCode",
    summary: "Перевыпустить секретный код",
    description:
      "Требует действующую сессию и текущий секретный код. Доступно только до установки пароля. Старый код отменяется, остальные сессии завершаются, токены текущей сессии заменяются через HttpOnly Secure cookies с SameSite=Strict. Новый код показывается только в этом ответе. Действует встроенная CSRF-защита NestJS",
    response: {
      status: 200,
      type: LoginCodeResponseDto,
      description: "Секретный код перевыпущен, текущая сессия обновлена",
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
      {
        status: 401,
        description: "Авторизация или текущий секретный код недействительны",
      },
      { status: 403, description: "Проверка защиты от CSRF не пройдена" },
      { status: 429, description: "Превышен лимит перевыпуска кода" },
    ],
  })
  async reissueCode(
    @Cookies("__Host-accessToken") accessToken: unknown,
    @Body() body: LoginCodeBodyDto,
    @Res({ passthrough: true }) reply: unknown,
  ): Promise<LoginCodeResponseDto> {
    const result = await this.authService.reissueCode(accessToken, body)

    this.securityCookieService.setAuthCookies(reply, result)

    return { accessCode: result.accessCode }
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
  ) {
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
