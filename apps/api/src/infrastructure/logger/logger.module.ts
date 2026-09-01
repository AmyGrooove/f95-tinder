import { Module } from "@nestjs/common"

import { InfrastructureConfigModule } from "@infrastructure/config/config.module"

import { LoggerService } from "./services/logger.service"
import { OpenObserveService } from "./services/openObserve.service"

@Module({
  imports: [InfrastructureConfigModule],
  providers: [LoggerService, OpenObserveService],
  exports: [LoggerService, OpenObserveService],
})
class LoggerModule {}

export { LoggerModule }
