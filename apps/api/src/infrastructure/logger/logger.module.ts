import { Module } from "@nestjs/common";

import { AppLoggerService } from "./services/appLogger.service";

@Module({
  providers: [AppLoggerService],
  exports: [AppLoggerService],
})
class LoggerModule {}

export { LoggerModule };
