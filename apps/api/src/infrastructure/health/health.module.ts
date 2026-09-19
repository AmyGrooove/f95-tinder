import { Module } from "@nestjs/common"
import { TerminusModule } from "@nestjs/terminus"

import { CacheModule } from "@infrastructure/cache/cache.module"
import { DatabaseModule } from "@infrastructure/database/database.module"
import { LoggerModule } from "@infrastructure/logger/logger.module"
import { StorageModule } from "@infrastructure/storage/storage.module"

import { HealthController } from "./controllers/health.controller"
import { HealthService } from "./services/health.service"

@Module({
  imports: [
    TerminusModule,
    CacheModule,
    DatabaseModule,
    LoggerModule,
    StorageModule,
  ],
  controllers: [HealthController],
  providers: [HealthService],
})
class HealthModule {}

export { HealthModule }
