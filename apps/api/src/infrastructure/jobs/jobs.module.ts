import { BullModule } from "@nestjs/bullmq"
import { Module } from "@nestjs/common"
import { DiscoveryModule } from "@nestjs/core"

import { InfrastructureConfigModule } from "../config/config.module"
import { InfrastructureConfigService } from "../config/services/configService"
import { LoggerModule } from "../logger/logger.module"
import { JobsHealthService } from "@infrastructure/jobs/services/jobsHealthService"
import { JobProcessorService } from "@infrastructure/jobs/services/jobProcessorService"
import { JobRegistryService } from "@infrastructure/jobs/services/jobRegistryService"
import { JobService } from "@infrastructure/jobs/services/jobService"
import { JOBS_QUEUE_NAME } from "./static/JOBS_QUEUE_NAME"

@Module({
  imports: [
    DiscoveryModule,
    LoggerModule,
    BullModule.forRootAsync({
      imports: [InfrastructureConfigModule],
      inject: [InfrastructureConfigService],
      useFactory: (
        infrastructureConfigService: InfrastructureConfigService,
      ) => {
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
    JobsHealthService,
    JobProcessorService,
    JobRegistryService,
    JobService,
  ],
  exports: [JobService, JobsHealthService],
})
class JobsModule {}

export { JobsModule }
