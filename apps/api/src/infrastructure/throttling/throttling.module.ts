import { Module } from "@nestjs/common"
import { APP_GUARD } from "@nestjs/core"
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler"
import { ThrottlerStorageRedisService } from "@nest-lab/throttler-storage-redis"

import { InfrastructureConfigModule } from "@infrastructure/config/config.module"
import { InfrastructureConfigService } from "@infrastructure/config/services/config.service"

import { THROTTLE_DEFAULTS } from "./static/THROTTLE_DEFAULTS"

@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      imports: [InfrastructureConfigModule],
      inject: [InfrastructureConfigService],
      useFactory: (configurationService: InfrastructureConfigService) => {
        return {
          throttlers: [THROTTLE_DEFAULTS],
          storage: new ThrottlerStorageRedisService(
            configurationService.redis.url,
          ),
        }
      },
    }),
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
class ThrottlingModule {}

export { ThrottlingModule }
