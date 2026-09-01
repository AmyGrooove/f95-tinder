import { Module } from "@nestjs/common"
import { TerminusModule } from "@nestjs/terminus"

import { CacheModule } from "@infrastructure/cache/cache.module"
import { DatabaseModule } from "@infrastructure/database/database.module"
import { JobsModule } from "@infrastructure/jobs/jobs.module"
import { LoggerModule } from "@infrastructure/logger/logger.module"
import { SearchModule } from "@infrastructure/search/search.module"
import { StorageModule } from "@infrastructure/storage/storage.module"

import { HealthController } from "./controllers/health.controller"
import { HealthService } from "./services/health.service"
import { InfrastructureHealthService } from "./services/infrastructureHealth.service"

@Module({
  imports: [
    TerminusModule,
    CacheModule,
    DatabaseModule,
    JobsModule,
    LoggerModule,
    StorageModule,
    SearchModule,
  ],
  controllers: [HealthController],
  providers: [InfrastructureHealthService, HealthService],
})
class HealthModule {}

export { HealthModule }
