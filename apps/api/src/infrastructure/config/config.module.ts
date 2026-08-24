import { Module } from "@nestjs/common"
import { ConfigModule, registerAs } from "@nestjs/config"

import { createInfrastructureConfiguration } from "./functions/createInfrastructureConfiguration"
import { validateEnvironment } from "./functions/validateEnvironment"
import { InfrastructureConfigService } from "./services/config.service"
import { CONFIG_NAMESPACE } from "./static/CONFIG_NAMESPACE"

const infrastructureConfiguration = registerAs(
  CONFIG_NAMESPACE,
  createInfrastructureConfiguration,
)

@Module({
  imports: [
    ConfigModule.forRoot({
      cache: true,
      isGlobal: true,
      load: [infrastructureConfiguration],
      validate: validateEnvironment,
    }),
  ],
  providers: [InfrastructureConfigService],
  exports: [ConfigModule, InfrastructureConfigService],
})
class InfrastructureConfigModule {}

export { InfrastructureConfigModule, infrastructureConfiguration }
