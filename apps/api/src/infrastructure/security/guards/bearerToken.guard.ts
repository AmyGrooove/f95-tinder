import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import { UserRepository } from '../../../entities/user/services/user.repository';
import { TokenService } from '../services/token.service';
import type { AuthenticatedRequest } from '../decorators/CurrentUserId';

@Injectable()
export class BearerTokenGuard implements CanActivate {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly tokenService: TokenService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<AuthenticatedRequest>();
    const token = this.extractToken(request.headers.authorization);

    if (!token) {
      throw this.invalidToken();
    }

    const user = await this.userRepository.findIdByTokenHash(
      this.tokenService.hash(token),
    );

    if (!user) {
      throw this.invalidToken();
    }

    request.userId = user.id;
    return true;
  }

  private extractToken(authorization: string | undefined): string | null {
    if (!authorization) {
      return null;
    }

    const match = /^Bearer ([^\s]+)$/i.exec(authorization);
    return match?.[1] ?? null;
  }

  private invalidToken(): UnauthorizedException {
    return new UnauthorizedException({
      statusCode: 401,
      code: 'invalid_token',
      message: 'Bearer token is missing or invalid',
    });
  }
}
