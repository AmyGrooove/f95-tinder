import { Module } from "@nestjs/common"
import { APP_FILTER } from "@nestjs/core"

import { CacheModule } from "@infrastructure/cache/cache.module"
import { InfrastructureConfigModule } from "@infrastructure/config/config.module"
import { DatabaseModule } from "@infrastructure/database/database.module"
import { AppExceptionFilter } from "@infrastructure/logger/decorators/AppExceptionFilter"
import { HealthModule } from "@infrastructure/health/health.module"
import { LoggerModule } from "@infrastructure/logger/logger.module"
import { SchedulerModule } from "@infrastructure/scheduler/scheduler.module"

@Module({
  imports: [
    InfrastructureConfigModule,
    LoggerModule,
    DatabaseModule,
    CacheModule,
    SchedulerModule,
    HealthModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: AppExceptionFilter,
    },
  ],
})
class AppModule {}

export { AppModule }
