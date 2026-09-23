import { Module } from "@nestjs/common"
import { TerminusModule } from "@nestjs/terminus"

import { CacheModule } from "@infrastructure/cache/cache.module"
import { DatabaseModule } from "@infrastructure/database/database.module"
import { JobsModule } from "@infrastructure/jobs/jobs.module"
import { MailModule } from "@infrastructure/mail/mail.module"
import { SchedulerModule } from "@infrastructure/scheduler/scheduler.module"
import { SearchModule } from "@infrastructure/search/search.module"
import { StorageModule } from "@infrastructure/storage/storage.module"

import { HealthController } from "./controllers/health.controller"
import { HealthService } from "./services/health.service"

@Module({
  imports: [
    TerminusModule,
    CacheModule,
    DatabaseModule,
    JobsModule,
    MailModule,
    SchedulerModule,
    SearchModule,
    StorageModule,
  ],
  controllers: [HealthController],
  providers: [HealthService],
})
class HealthModule {}

export { HealthModule }
