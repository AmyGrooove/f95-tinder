import { Module } from "@nestjs/common"
import { ConfigModule, registerAs } from "@nestjs/config"

import { createInfrastructureConfiguration } from "./functions/createInfrastructureConfiguration"
import { InfrastructureConfigService } from "./services/config.service"

const infrastructureConfiguration = registerAs(
  "infrastructure",
  createInfrastructureConfiguration,
)

@Module({
  imports: [
    ConfigModule.forRoot({
      ignoreEnvFile: process.env.NODE_ENV === "test",
      cache: true,
      isGlobal: true,
      load: [infrastructureConfiguration],
    }),
  ],
  providers: [InfrastructureConfigService],
  exports: [ConfigModule, InfrastructureConfigService],
})
class InfrastructureConfigModule {}

export { InfrastructureConfigModule, infrastructureConfiguration }
