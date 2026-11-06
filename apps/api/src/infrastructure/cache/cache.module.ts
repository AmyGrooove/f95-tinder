import { CacheModule as NestCacheModule } from "@nestjs/cache-manager"
import { Module } from "@nestjs/common"
import { createKeyv } from "@keyv/redis"

import { InfrastructureConfigModule } from "@infrastructure/config/config.module"
import { InfrastructureConfigService } from "@infrastructure/config/services/configService"

import { CacheHealthService } from "./services/cacheHealthService"
import { CacheService } from "./services/cacheService"
import { CursorService } from "./services/cursorService"

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
  providers: [CacheHealthService, CacheService, CursorService],
  exports: [NestCacheModule, CacheHealthService, CacheService, CursorService],
})
class CacheModule {}

export { CacheModule }
