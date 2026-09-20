import { Module } from "@nestjs/common"
import { APP_GUARD } from "@nestjs/core"
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler"
import { RedisModule, RedisToken } from "@nestjs-redis/client"
import { RedisThrottlerStorage } from "@nestjs-redis/throttler-storage"

import { InfrastructureConfigModule } from "@infrastructure/config/config.module"
import { InfrastructureConfigService } from "@infrastructure/config/services/config.service"

import { THROTTLE_DEFAULTS } from "./static/THROTTLE_DEFAULTS"

@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      imports: [
        RedisModule.forRootAsync({
          imports: [InfrastructureConfigModule],
          inject: [InfrastructureConfigService],
          useFactory: (configurationService: InfrastructureConfigService) => {
            return {
              options: { url: configurationService.redis.url },
            }
          },
        }),
      ],
      inject: [RedisToken()],
      useFactory: (redis) => {
        return {
          throttlers: [THROTTLE_DEFAULTS],
          storage: new RedisThrottlerStorage(redis),
        }
      },
    }),
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
class ThrottlingModule {}

export { ThrottlingModule }
