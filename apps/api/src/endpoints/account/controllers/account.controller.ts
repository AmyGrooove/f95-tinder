import {
  Body,
  Controller,
  Cookies,
  Get,
  Header,
  HttpCode,
  Patch,
  Post,
  Res,
} from "@nestjs/common"
import { ApiCookieAuth, ApiTags } from "@nestjs/swagger"
import { Throttle } from "@nestjs/throttler"

import { ApiEndpoint } from "@infrastructure/logger/decorators/ApiEndpoint"
import { SecurityCookieService } from "@infrastructure/security/services/cookie.service"

import { DisplayNameBodyDto } from "../dto/body/displayName.body"
import { UsernameBodyDto } from "../dto/body/username.body"
import { AccountResponseDto } from "../dto/response/account.response"
import { WhoamiResponseDto } from "../dto/response/whoami.response"
import { AccountService } from "../services/account.service"
import { AccountSetupService } from "../services/accountSetup.service"
import { SetupBodyDto } from "../dto/body/setup.body"
import { ConfirmSetupBodyDto } from "../dto/body/confirmSetup.body"
import { PasswordBodyDto } from "../dto/body/password.body"
import { EmailBodyDto } from "../dto/body/email.body"
import { ConfirmEmailBodyDto } from "../dto/body/confirmEmail.body"
import { AccountEmailService } from "../services/accountEmail.service"

@ApiTags("Аккаунт")
@Controller("account")
class AccountController {
  constructor(
    private readonly accountService: AccountService,
    private readonly accountSetupService: AccountSetupService,
    private readonly accountEmailService: AccountEmailService,
    private readonly securityCookieService: SecurityCookieService,
  ) {}

  @Patch("email")
  @HttpCode(204)
  @Header("Cache-Control", "no-store")
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiCookieAuth("accessCookie")
  @ApiEndpoint({
    operationId: "AccountController_confirmEmail",
    summary: "Подтвердить изменение email текущего пользователя",
    description:
      "Требует действующую сессию и шестизначный код из письма на новый email. Подтверждение связано с пользователем, новым и прежним адресами и паролем на момент запроса. После трёх неверных попыток, истечения срока или погашения кода требуется новый запрос смены email. Погашенный код не восстанавливается при ошибке записи или занятом адресе: запросите новое письмо. Сессии и cookies сохраняются. Действует встроенная CSRF-защита NestJS",
    response: {
      status: 204,
      description: "Новый email подтверждён и установлен",
    },
    errors: [
      {
        status: 400,
        description:
          "Некорректные данные запроса или недействительное подтверждение",
      },
      {
        status: 401,
        description: "Авторизация отсутствует или недействительна",
      },
      { status: 403, description: "Проверка защиты от CSRF не пройдена" },
      {
        status: 409,
        description:
          "Первоначальная настройка не завершена или email уже занят",
      },
      { status: 429, description: "Превышен лимит запросов" },
    ],
  })
  confirmEmail(
    @Cookies("__Host-accessToken") accessToken: unknown,
    @Body() body: ConfirmEmailBodyDto,
  ) {
    return this.accountEmailService.confirmEmail(accessToken, body)
  }

  @Post("email")
  @HttpCode(204)
  @Header("Cache-Control", "no-store")
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiCookieAuth("accessCookie")
  @ApiEndpoint({
    operationId: "AccountController_requestEmail",
    summary: "Запросить изменение email текущего пользователя",
    description:
      "Требует действующую сессию и текущий пароль. Доступно после первоначальной настройки. Отправляет на новый email код из 6 цифр со сроком действия 4 часа и лимитом 3 неверных попыток при подтверждении. Повторный запрос доступен через минуту на аккаунт и отменяет предыдущий код смены email. Текущий адрес пока не изменяется; подтверждение выполняется через PATCH /account/email. Действует встроенная CSRF-защита NestJS",
    response: {
      status: 204,
      description:
        "Подтверждение сохранено в Redis, письмо поставлено в очередь",
    },
    errors: [
      { status: 400, description: "Некорректные данные запроса" },
      {
        status: 401,
        description: "Авторизация или текущий пароль недействительны",
      },
      { status: 403, description: "Проверка защиты от CSRF не пройдена" },
      {
        status: 409,
        description:
          "Первоначальная настройка не завершена или email уже занят",
      },
      {
        status: 429,
        description:
          "Повторный запрос раньше минуты или превышен лимит запросов",
      },
      { status: 503, description: "Не удалось поставить письмо в очередь" },
    ],
  })
  requestEmail(
    @Cookies("__Host-accessToken") accessToken: unknown,
    @Body() body: EmailBodyDto,
  ) {
    return this.accountEmailService.requestEmail(accessToken, body)
  }

  @Patch("password")
  @HttpCode(204)
  @Header("Cache-Control", "no-store")
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiCookieAuth("accessCookie")
  @ApiEndpoint({
    operationId: "AccountController_updatePassword",
    summary: "Изменить пароль текущего пользователя",
    description:
      "Требует действующую сессию и текущий пароль. Доступно после установки пароля. Атомарно изменяет пароль, завершает остальные сессии и обновляет токены текущей сессии через HttpOnly Secure cookies с SameSite=Strict. Действует встроенная CSRF-защита NestJS",
    response: {
      status: 204,
      description: "Пароль изменён, текущая сессия обновлена",
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
        description: "Авторизация или текущий пароль недействительны",
      },
      { status: 403, description: "Проверка защиты от CSRF не пройдена" },
      { status: 409, description: "Пароль ещё не установлен" },
      { status: 429, description: "Превышен лимит попыток изменения пароля" },
    ],
  })
  async updatePassword(
    @Cookies("__Host-accessToken") accessToken: unknown,
    @Body() body: PasswordBodyDto,
    @Res({ passthrough: true }) reply: unknown,
  ) {
    const tokens = await this.accountService.updatePassword(accessToken, body)

    this.securityCookieService.setAuthCookies(reply, tokens)
  }

  @Patch("setup")
  @HttpCode(204)
  @Header("Cache-Control", "no-store")
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiCookieAuth("accessCookie")
  @ApiEndpoint({
    operationId: "AccountController_confirmSetup",
    summary: "Подтвердить первоначальную настройку аккаунта",
    description:
      "Требует действующую сессию и шестизначный код из письма. Атомарно устанавливает подтверждённый email и пароль, удаляет стартовый секретный код. После трёх неверных попыток, истечения срока или погашения кода требуется новый запрос настройки. Погашенный код не восстанавливается при ошибке записи: запросите новое письмо. Действует встроенная CSRF-защита NestJS",
    response: {
      status: 204,
      description: "Первоначальная настройка аккаунта завершена",
    },
    errors: [
      {
        status: 400,
        description:
          "Некорректные данные запроса или недействительное подтверждение",
      },
      {
        status: 401,
        description: "Авторизация отсутствует или недействительна",
      },
      { status: 403, description: "Проверка защиты от CSRF не пройдена" },
      {
        status: 409,
        description: "Первоначальная настройка недоступна или email уже занят",
      },
      { status: 429, description: "Превышен лимит запросов" },
    ],
  })
  confirmSetup(
    @Cookies("__Host-accessToken") accessToken: unknown,
    @Body() body: ConfirmSetupBodyDto,
  ) {
    return this.accountSetupService.confirmSetup(accessToken, body)
  }

  @Post("setup")
  @HttpCode(204)
  @Header("Cache-Control", "no-store")
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiCookieAuth("accessCookie")
  @ApiEndpoint({
    operationId: "AccountController_requestSetup",
    summary: "Запросить первоначальную настройку аккаунта",
    description:
      "Требует действующую сессию и текущий секретный код. Принимает email и новый пароль только до первоначальной настройки. Код из 6 цифр действует 4 часа и допускает 3 неверные попытки при подтверждении. Повторный запрос доступен через минуту на аккаунт и отменяет предыдущий код. Email и пароль пока не применяются; подтверждение выполняется через PATCH /account/setup. Действует встроенная CSRF-защита NestJS",
    response: {
      status: 204,
      description:
        "Подтверждение сохранено в Redis, письмо поставлено в очередь",
    },
    errors: [
      { status: 400, description: "Некорректные данные запроса" },
      {
        status: 401,
        description: "Авторизация или текущий секретный код недействительны",
      },
      { status: 403, description: "Проверка защиты от CSRF не пройдена" },
      {
        status: 409,
        description: "Первоначальная настройка недоступна или email уже занят",
      },
      {
        status: 429,
        description:
          "Повторный запрос раньше минуты или превышен лимит запросов",
      },
      { status: 503, description: "Не удалось поставить письмо в очередь" },
    ],
  })
  requestSetup(
    @Cookies("__Host-accessToken") accessToken: unknown,
    @Body() body: SetupBodyDto,
  ) {
    return this.accountSetupService.requestSetup(accessToken, body)
  }

  @Patch("displayName")
  @HttpCode(204)
  @Header("Cache-Control", "no-store")
  @ApiCookieAuth("accessCookie")
  @ApiEndpoint({
    operationId: "AccountController_updateDisplayName",
    summary: "Изменить отображаемое имя текущего пользователя",
    description:
      "Требует действующий JWT в cookie __Host-accessToken и неистёкшую серверную сессию текущего пользователя. Повторная установка своего имени допустима. Действует встроенная CSRF-защита NestJS",
    response: {
      status: 204,
      description: "Отображаемое имя изменено",
    },
    errors: [
      { status: 400, description: "Некорректные данные запроса" },
      {
        status: 401,
        description: "Авторизация отсутствует или недействительна",
      },
      { status: 403, description: "Проверка защиты от CSRF не пройдена" },
      { status: 429, description: "Превышен лимит запросов" },
    ],
  })
  updateDisplayName(
    @Cookies("__Host-accessToken") accessToken: unknown,
    @Body() body: DisplayNameBodyDto,
  ) {
    return this.accountService.updateDisplayName(accessToken, body)
  }

  @Patch("username")
  @HttpCode(204)
  @Header("Cache-Control", "no-store")
  @ApiCookieAuth("accessCookie")
  @ApiEndpoint({
    operationId: "AccountController_updateUsername",
    summary: "Изменить логин текущего пользователя",
    description:
      "Требует действующий JWT в cookie __Host-accessToken и неистёкшую серверную сессию текущего пользователя. Логин должен быть уникальным. Повторная установка своего логина допустима. Не изменяет отображаемое имя, сессии и cookies. Действует встроенная CSRF-защита NestJS",
    response: {
      status: 204,
      description: "Логин изменён",
    },
    errors: [
      { status: 400, description: "Некорректные данные запроса" },
      {
        status: 401,
        description: "Авторизация отсутствует или недействительна",
      },
      { status: 403, description: "Проверка защиты от CSRF не пройдена" },
      { status: 409, description: "Логин уже занят" },
      { status: 429, description: "Превышен лимит запросов" },
    ],
  })
  updateUsername(
    @Cookies("__Host-accessToken") accessToken: unknown,
    @Body() body: UsernameBodyDto,
  ) {
    return this.accountService.updateUsername(accessToken, body)
  }

  @Get()
  @Header("Cache-Control", "no-store")
  @ApiCookieAuth("accessCookie")
  @ApiEndpoint({
    operationId: "AccountController_getAccount",
    summary: "Получить полный профиль текущего пользователя",
    description:
      "Требует действующий JWT в cookie __Host-accessToken и неистёкшую серверную сессию текущего пользователя. Возвращает данные профиля и состояние способов входа без хешей и токенов",
    response: {
      status: 200,
      type: AccountResponseDto,
      description: "Полный профиль текущего пользователя",
    },
    errors: [
      {
        status: 401,
        description: "Авторизация отсутствует или недействительна",
      },
      { status: 429, description: "Превышен лимит запросов" },
    ],
  })
  getAccount(@Cookies("__Host-accessToken") accessToken: unknown) {
    return this.accountService.getAccount(accessToken)
  }

  @Get("whoami")
  @Header("Cache-Control", "no-store")
  @ApiCookieAuth("accessCookie")
  @ApiEndpoint({
    operationId: "AccountController_whoami",
    summary: "Получить текущего пользователя и сессию",
    description:
      "Требует действующий JWT в cookie __Host-accessToken и неистёкшую серверную сессию текущего пользователя",
    response: {
      status: 200,
      type: WhoamiResponseDto,
      description: "Краткие данные пользователя и текущая сессия",
    },
    errors: [
      {
        status: 401,
        description: "Авторизация отсутствует или недействительна",
      },
      { status: 429, description: "Превышен лимит запросов" },
    ],
  })
  whoami(@Cookies("__Host-accessToken") accessToken: unknown) {
    return this.accountService.whoami(accessToken)
  }
}

export { AccountController }
