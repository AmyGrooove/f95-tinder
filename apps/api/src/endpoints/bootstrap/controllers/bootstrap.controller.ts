import { Controller, Get, UseGuards } from "@nestjs/common"
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger"

import { AccessTokenGuard } from "@infrastructure/security/guards/accessToken.guard"
import { CurrentUser } from "@infrastructure/security/decorators/CurrentUser"
import type { IAuthPrincipal } from "@infrastructure/security/types/IAuthPrincipal"

import { BootstrapResponseDto } from "../dto/response/bootstrap.response"
import { BootstrapService } from "../services/bootstrap.service"
import { AuthService } from "../../auth/services/auth.service"

@ApiTags("Bootstrap")
@ApiBearerAuth("authToken")
@UseGuards(AccessTokenGuard)
@Controller("app")
class BootstrapController {
  constructor(
    private readonly authService: AuthService,
    private readonly bootstrapService: BootstrapService,
  ) {}

  @Get("bootstrap")
  @ApiOperation({ summary: "Get Electron startup payload" })
  @ApiOkResponse({ type: BootstrapResponseDto })
  async getBootstrap(
    @CurrentUser() authPrincipal: IAuthPrincipal,
  ): Promise<BootstrapResponseDto> {
    const user = await this.authService.getSession(authPrincipal.id)

    return this.bootstrapService.getBootstrap(user)
  }
}

export { BootstrapController }
