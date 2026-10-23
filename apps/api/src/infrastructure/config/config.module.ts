import { Module } from "@nestjs/common"
import { ConfigModule } from "@nestjs/config"

import { InfrastructureConfigService } from "./services/config.service"
import { INFRASTRUCTURE_CONFIGURATION } from "./static/INFRASTRUCTURE_CONFIGURATION"

@Module({
  imports: [
    ConfigModule.forRoot({
      ignoreEnvFile: process.env.NODE_ENV === "test",
      cache: true,
      isGlobal: true,
      load: [INFRASTRUCTURE_CONFIGURATION],
    }),
  ],
  providers: [InfrastructureConfigService],
  exports: [ConfigModule, InfrastructureConfigService],
})
class InfrastructureConfigModule {}

export { InfrastructureConfigModule }
export { INFRASTRUCTURE_CONFIGURATION as infrastructureConfiguration } from "./static/INFRASTRUCTURE_CONFIGURATION"
