import { Module } from '@nestjs/common';

import { UserModule } from '../../entities/user/user.module';
import { BearerTokenGuard } from './guards/bearerToken.guard';
import { TokenService } from './services/token.service';

@Module({
  imports: [UserModule],
  providers: [TokenService, BearerTokenGuard],
  exports: [UserModule, TokenService, BearerTokenGuard],
})
export class SecurityModule {}
