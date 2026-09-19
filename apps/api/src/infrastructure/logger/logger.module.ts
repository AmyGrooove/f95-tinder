import { Module } from "@nestjs/common"

import { InfrastructureConfigModule } from "@infrastructure/config/config.module"

import { LoggerService } from "./services/logger.service"
import { LoggerHealthService } from "./services/loggerHealth.service"
import { OpenObserveService } from "./services/openObserve.service"

@Module({
  imports: [InfrastructureConfigModule],
  providers: [LoggerService, LoggerHealthService, OpenObserveService],
  exports: [LoggerService, LoggerHealthService],
})
class LoggerModule {}

export { LoggerModule }
