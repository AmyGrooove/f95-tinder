import { BullModule } from "@nestjs/bullmq"
import { Module } from "@nestjs/common"

import { InfrastructureConfigModule } from "../config/config.module"
import { InfrastructureConfigService } from "../config/services/config.service"
import { JobService } from "./services/job.service"
import { JOBS_QUEUE_NAME } from "./static/JOBS_QUEUE_NAME"

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [InfrastructureConfigModule],
      inject: [InfrastructureConfigService],
      useFactory: (infrastructureConfigService: InfrastructureConfigService) => {
        return {
          connection: {
            db: infrastructureConfigService.redis.database,
            host: infrastructureConfigService.redis.host,
            port: infrastructureConfigService.redis.port,
            tls: infrastructureConfigService.redis.isTls ? {} : undefined,
          },
          prefix: infrastructureConfigService.app.name,
        }
      },
    }),
    BullModule.registerQueue({ name: JOBS_QUEUE_NAME }),
  ],
  providers: [JobService],
  exports: [BullModule, JobService],
})
class JobsModule {}

export { JobsModule }
