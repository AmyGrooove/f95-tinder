import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  UseGuards,
} from "@nestjs/common"
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger"

import { AccessTokenGuard } from "@infrastructure/security/guards/accessToken.guard"
import { CurrentUser } from "@infrastructure/security/decorators/CurrentUser"
import type { IAuthPrincipal } from "@infrastructure/security/types/IAuthPrincipal"

import { LoginBodyDto } from "../dto/body/login.body"
import { RefreshBodyDto } from "../dto/body/refresh.body"
import { RegisterBodyDto } from "../dto/body/register.body"
import {
  AuthSessionResponseDto,
  AuthUserDto,
} from "../dto/response/auth-session.response"
import { AuthService } from "../services/auth.service"

@ApiTags("Auth")
@Controller("auth")
class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("register")
  @ApiOperation({ summary: "Register a user account" })
  @ApiOkResponse({ type: AuthSessionResponseDto })
  register(
    @Body() registerBody: RegisterBodyDto,
  ): Promise<AuthSessionResponseDto> {
    return this.authService.register(registerBody)
  }

  @Post("login")
  @HttpCode(200)
  @ApiOperation({ summary: "Login with email and password" })
  @ApiOkResponse({ type: AuthSessionResponseDto })
  login(@Body() loginBody: LoginBodyDto): Promise<AuthSessionResponseDto> {
    return this.authService.login(loginBody)
  }

  @Post("refresh")
  @HttpCode(200)
  @ApiOperation({ summary: "Refresh an auth session" })
  @ApiOkResponse({ type: AuthSessionResponseDto })
  refresh(
    @Body() refreshBody: RefreshBodyDto,
  ): Promise<AuthSessionResponseDto> {
    return this.authService.refresh(refreshBody)
  }

  @Post("logout")
  @HttpCode(204)
  @UseGuards(AccessTokenGuard)
  @ApiBearerAuth("authToken")
  @ApiOperation({ summary: "Logout an auth session" })
  logout(
    @Body() refreshBody: RefreshBodyDto,
    @CurrentUser("id") userId: string,
  ): Promise<void> {
    return this.authService.logout(refreshBody, userId)
  }

  @Get("session")
  @UseGuards(AccessTokenGuard)
  @ApiBearerAuth("authToken")
  @ApiOperation({ summary: "Get the current auth session user" })
  @ApiOkResponse({ type: AuthUserDto })
  getSession(
    @CurrentUser() authPrincipal: IAuthPrincipal,
  ): Promise<AuthUserDto> {
    return this.authService.getSession(authPrincipal.id)
  }
}

export { AuthController }
