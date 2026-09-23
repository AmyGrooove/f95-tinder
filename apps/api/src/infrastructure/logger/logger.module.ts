import { Module } from "@nestjs/common"

import { InfrastructureConfigModule } from "@infrastructure/config/config.module"

import { LoggerService } from "./services/logger.service"

@Module({
  imports: [InfrastructureConfigModule],
  providers: [LoggerService],
  exports: [LoggerService],
})
class LoggerModule {}

export { LoggerModule }
