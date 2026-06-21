import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';

import { CurrentUserId } from '../../../infrastructure/security/decorators/CurrentUserId';
import { BearerTokenGuard } from '../../../infrastructure/security/guards/bearerToken.guard';
import { CreateUserResponseDto } from '../dto/createUserResponse.dto';
import {
  SessionResponseDto,
  TokenResponseDto,
} from '../dto/sessionResponse.dto';
import { AuthService } from '../services/auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('createUser')
  @HttpCode(HttpStatus.CREATED)
  createUser(): Promise<CreateUserResponseDto> {
    return this.authService.createUser();
  }

  @Get('session')
  @UseGuards(BearerTokenGuard)
  getSession(
    @CurrentUserId() userId: string,
  ): SessionResponseDto {
    return this.authService.getSession(userId);
  }

  @Get('token')
  @UseGuards(BearerTokenGuard)
  getToken(
    @CurrentUserId() userId: string,
  ): Promise<TokenResponseDto> {
    return this.authService.getToken(userId);
  }
}
