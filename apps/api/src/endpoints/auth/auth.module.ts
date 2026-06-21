import { Module } from '@nestjs/common';

import { SecurityModule } from '../../infrastructure/security/security.module';
import { AuthController } from './controllers/auth.controller';
import { AuthService } from './services/auth.service';

@Module({
  imports: [SecurityModule],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
