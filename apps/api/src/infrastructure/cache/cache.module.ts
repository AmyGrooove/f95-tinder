import { CacheModule as NestCacheModule } from "@nestjs/cache-manager"
import { Module } from "@nestjs/common"
import { createKeyv } from "@keyv/redis"

import { InfrastructureConfigModule } from "@infrastructure/config/config.module"
import { InfrastructureConfigService } from "@infrastructure/config/services/config.service"

import { CacheHealthService } from "./services/cacheHealth.service"
import { CacheService } from "./services/cache.service"

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
              throwOnErrors: true,
            }),
          ],
        }
      },
    }),
  ],
  providers: [CacheHealthService, CacheService],
  exports: [NestCacheModule, CacheHealthService, CacheService],
})
class CacheModule {}

export { CacheModule }
