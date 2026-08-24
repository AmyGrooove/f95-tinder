import { Module } from "@nestjs/common"
import { MongooseModule } from "@nestjs/mongoose"

import { InfrastructureConfigModule } from "@infrastructure/config/config.module"
import { InfrastructureConfigService } from "@infrastructure/config/services/config.service"

import { applyTimestampsPlugin } from "./functions/applyTimestampsPlugin"
import { applyToJsonPlugin } from "./functions/applyToJsonPlugin"

@Module({
  imports: [
    MongooseModule.forRootAsync({
      imports: [InfrastructureConfigModule],
      inject: [InfrastructureConfigService],
      useFactory: (configurationService: InfrastructureConfigService) => {
        return {
          uri: configurationService.database.uri,
          autoIndex: configurationService.app.environment !== "production",
          connectionFactory: (connection) => {
            connection.plugin(applyTimestampsPlugin)
            connection.plugin(applyToJsonPlugin)

            return connection
          },
        }
      },
    }),
  ],
  exports: [MongooseModule],
})
class DatabaseModule {}

export { DatabaseModule }
