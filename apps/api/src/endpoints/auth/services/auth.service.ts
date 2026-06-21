import { Injectable, UnauthorizedException } from '@nestjs/common';

import { UserRepository } from '../../../entities/user/services/user.repository';
import { TokenService } from '../../../infrastructure/security/services/token.service';
import { CreateUserResponseDto } from '../dto/createUserResponse.dto';
import {
  SessionResponseDto,
  TokenResponseDto,
} from '../dto/sessionResponse.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly tokenService: TokenService,
  ) {}

  async createUser(): Promise<CreateUserResponseDto> {
    const token = this.tokenService.generate();
    const encryptedToken = this.tokenService.encrypt(token);
    const user = await this.userRepository.create({
      tokenHash: this.tokenService.hash(token),
      tokenEncrypted: encryptedToken.encrypted,
      tokenEncryptionIv: encryptedToken.iv,
      tokenEncryptionTag: encryptedToken.authenticationTag,
      tokenEncryptionKeyVersion: encryptedToken.keyVersion,
    });

    return {
      userId: String(user._id),
      token,
    };
  }

  getSession(userId: string): SessionResponseDto {
    return { userId };
  }

  async getToken(userId: string): Promise<TokenResponseDto> {
    const user = await this.userRepository.findTokenById(userId);

    if (!user) {
      throw new UnauthorizedException({
        statusCode: 401,
        code: 'invalid_token',
        message: 'Authenticated user no longer exists',
      });
    }

    return {
      token: this.tokenService.decrypt({
        encrypted: user.tokenEncrypted,
        iv: user.tokenEncryptionIv,
        authenticationTag: user.tokenEncryptionTag,
        keyVersion: user.tokenEncryptionKeyVersion,
      }),
    };
  }
}
