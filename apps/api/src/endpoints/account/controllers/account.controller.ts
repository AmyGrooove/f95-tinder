import { Controller, Cookies, Get, Header } from "@nestjs/common"
import { ApiCookieAuth, ApiTags } from "@nestjs/swagger"

import { ApiEndpoint } from "@infrastructure/logger/decorators/ApiEndpoint"

import { WhoamiResponseDto } from "../dto/response/whoami.response"
import { AccountService } from "../services/account.service"

@ApiTags("Аккаунт")
@Controller("account")
class AccountController {
  constructor(private readonly accountService: AccountService) {}

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
