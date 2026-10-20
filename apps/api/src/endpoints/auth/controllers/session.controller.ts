import {
  Controller,
  Cookies,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  Patch,
  Res,
} from "@nestjs/common"
import { ApiCookieAuth, ApiTags } from "@nestjs/swagger"
import { Types } from "mongoose"

import { ApiEndpoint } from "@infrastructure/logger/decorators/ApiEndpoint"
import { SecurityCookieService } from "@infrastructure/security/services/cookie.service"

import { SessionResponseDto } from "../dto/response/session.response"
import { SessionParamsDto } from "../dto/params/session.params"
import { SessionService } from "../services/session.service"
import { SWAGGER_DICTIONARY } from "@entities/shared/static/SWAGGER_DICTIONARY"

@ApiTags(SWAGGER_DICTIONARY.tags.sessions)
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
    summary: SWAGGER_DICTIONARY.auth.getSessions.summary,
    description: SWAGGER_DICTIONARY.auth.getSessions.description,
    response: {
      status: 200,
      type: SessionResponseDto,
      isArray: true,
      description: SWAGGER_DICTIONARY.auth.getSessions.response,
    },
    errors: [
      {
        status: 401,
        description: SWAGGER_DICTIONARY.common.unauthorized,
      },
      { status: 429, description: SWAGGER_DICTIONARY.common.rateLimitExceeded },
    ],
  })
  getSessions(
    @Cookies("__Host-accessToken") accessToken: unknown,
  ): Promise<SessionResponseDto[]> {
    return this.sessionService.getSessions(accessToken)
  }

  @Delete("others")
  @HttpCode(204)
  @Header("Cache-Control", "no-store")
  @ApiCookieAuth("accessCookie")
  @ApiEndpoint({
    operationId: "AuthController_deleteOtherSessions",
    summary: SWAGGER_DICTIONARY.auth.deleteOtherSessions.summary,
    description: SWAGGER_DICTIONARY.auth.deleteOtherSessions.description,
    response: {
      status: 204,
      description: SWAGGER_DICTIONARY.auth.deleteOtherSessions.response,
    },
    errors: [
      {
        status: 401,
        description: SWAGGER_DICTIONARY.common.unauthorized,
      },
      { status: 403, description: SWAGGER_DICTIONARY.common.csrfFailed },
      { status: 429, description: SWAGGER_DICTIONARY.common.rateLimitExceeded },
    ],
  })
  async deleteOtherSessions(
    @Cookies("__Host-accessToken") accessToken: unknown,
  ) {
    await this.sessionService.deleteOtherSessions(accessToken)
  }

  @Delete(":sessionId")
  @HttpCode(204)
  @Header("Cache-Control", "no-store")
  @ApiCookieAuth("accessCookie")
  @ApiEndpoint({
    operationId: "AuthController_deleteSession",
    summary: SWAGGER_DICTIONARY.auth.deleteSession.summary,
    description: SWAGGER_DICTIONARY.auth.deleteSession.description,
    response: {
      status: 204,
      description: SWAGGER_DICTIONARY.auth.deleteSession.response,
      headers: {
        "Set-Cookie": {
          description: SWAGGER_DICTIONARY.auth.deleteSession.cookies,
          schema: { type: "string" },
        },
      },
    },
    errors: [
      {
        status: 400,
        description: SWAGGER_DICTIONARY.auth.deleteSession.errors.status400,
      },
      {
        status: 401,
        description: SWAGGER_DICTIONARY.common.unauthorized,
      },
      { status: 403, description: SWAGGER_DICTIONARY.common.csrfFailed },
      {
        status: 404,
        description: SWAGGER_DICTIONARY.auth.deleteSession.errors.status404,
      },
      { status: 429, description: SWAGGER_DICTIONARY.common.rateLimitExceeded },
    ],
  })
  async deleteSession(
    @Cookies("__Host-accessToken") accessToken: unknown,
    @Param() params: SessionParamsDto,
    @Res({ passthrough: true }) reply: unknown,
  ) {
    const isCurrent = await this.sessionService.deleteSession(
      accessToken,
      new Types.ObjectId(params.sessionId),
    )

    if (isCurrent) {
      this.securityCookieService.clearAuthCookies(reply)
    }
  }

  @Patch("refresh")
  @HttpCode(204)
  @Header("Cache-Control", "no-store")
  @ApiCookieAuth("refreshCookie")
  @ApiEndpoint({
    operationId: "AuthController_refresh",
    summary: SWAGGER_DICTIONARY.auth.refresh.summary,
    description: SWAGGER_DICTIONARY.auth.refresh.description,
    response: {
      status: 204,
      description: SWAGGER_DICTIONARY.auth.refresh.response,
      headers: {
        "Set-Cookie": {
          description: SWAGGER_DICTIONARY.common.authCookies,
          schema: { type: "string" },
        },
      },
    },
    errors: [
      {
        status: 401,
        description: SWAGGER_DICTIONARY.common.unauthorized,
      },
      { status: 403, description: SWAGGER_DICTIONARY.common.csrfFailed },
      { status: 429, description: SWAGGER_DICTIONARY.common.rateLimitExceeded },
    ],
  })
  async refresh(
    @Cookies("__Host-refreshToken") refreshToken: unknown,
    @Res({ passthrough: true }) reply: unknown,
  ) {
    const tokens = await this.sessionService.refresh(refreshToken)

    this.securityCookieService.setAuthCookies(reply, tokens)
  }
}

export { SessionController }
