import { BullModule } from "@nestjs/bullmq"
import { Module } from "@nestjs/common"
import { DiscoveryModule } from "@nestjs/core"

import { InfrastructureConfigModule } from "../config/config.module"
import { InfrastructureConfigService } from "../config/services/config.service"
import { LoggerModule } from "../logger/logger.module"
import { JobDispatcher } from "./services/jobDispatcher.service"
import { JobConcurrencyService } from "./services/jobConcurrency.service"
import { JobProcessorService } from "./services/jobProcessor.service"
import { JobRegistry } from "./services/jobRegistry.service"
import { JobService } from "./services/job.service"
import { JOBS_QUEUE_NAME } from "./static/JOBS_QUEUE_NAME"

@Module({
  imports: [
    DiscoveryModule,
    LoggerModule,
    BullModule.forRootAsync({
      imports: [InfrastructureConfigModule],
      inject: [InfrastructureConfigService],
      useFactory: (infrastructureConfigService: InfrastructureConfigService) => {
        return {
          connection: {
            db: infrastructureConfigService.redis.database,
            host: infrastructureConfigService.redis.host,
            password: infrastructureConfigService.redis.password,
            port: infrastructureConfigService.redis.port,
            tls: infrastructureConfigService.redis.isTls ? {} : undefined,
            username: infrastructureConfigService.redis.username,
          },
          prefix: infrastructureConfigService.app.name,
        }
      },
    }),
    BullModule.registerQueue({ name: JOBS_QUEUE_NAME }),
  ],
  providers: [
    JobConcurrencyService,
    JobDispatcher,
    JobProcessorService,
    JobRegistry,
    JobService,
  ],
  exports: [BullModule, JobService],
})
class JobsModule {}

export { JobsModule }
