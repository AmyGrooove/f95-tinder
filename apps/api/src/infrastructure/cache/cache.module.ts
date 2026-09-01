import { CacheModule as NestCacheModule } from "@nestjs/cache-manager"
import { Module } from "@nestjs/common"
import { APP_GUARD } from "@nestjs/core"
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler"
import { createKeyv } from "@keyv/redis"
import { ThrottlerStorageRedisService } from "@nest-lab/throttler-storage-redis"

import { InfrastructureConfigModule } from "@infrastructure/config/config.module"
import { InfrastructureConfigService } from "@infrastructure/config/services/config.service"

import { CacheService } from "./services/cache.service"
import { THROTTLE_DEFAULTS } from "./static/THROTTLE_DEFAULTS"

@Module({
  imports: [
    NestCacheModule.registerAsync({
      imports: [InfrastructureConfigModule],
      inject: [InfrastructureConfigService],
      useFactory: (configurationService: InfrastructureConfigService) => {
        const normalizedNamespace = configurationService.app.name
          .split(":")
          .filter(Boolean)
          .join(":")

        return {
          stores: [
            createKeyv(configurationService.redis.url, {
              namespace: normalizedNamespace,
              keyPrefixSeparator: ":",
            }),
          ],
        }
      },
    }),
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
  providers: [
    CacheService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
  exports: [NestCacheModule, ThrottlerModule, CacheService],
})
class CacheModule {}

export { CacheModule }
