import { Module } from "@nestjs/common"
import { MongooseModule } from "@nestjs/mongoose"

import { InfrastructureConfigModule } from "@infrastructure/config/config.module"
import { InfrastructureConfigService } from "@infrastructure/config/services/config.service"

import { applyTimestampsPlugin } from "./functions/applyTimestampsPlugin"
import { applyToJsonPlugin } from "./functions/applyToJsonPlugin"
import { applyVersionKeyPlugin } from "./functions/applyVersionKeyPlugin"
import { MongoHealthService } from "./services/mongoHealth.service"
import { MongoTransactionService } from "./services/mongoTransaction.service"

@Module({
  imports: [
    MongooseModule.forRootAsync({
      imports: [InfrastructureConfigModule],
      inject: [InfrastructureConfigService],
      useFactory: (configurationService: InfrastructureConfigService) => {
        return {
          uri: configurationService.database.uri,
          autoIndex: true,
          connectionFactory: (connection) => {
            connection.plugin(applyTimestampsPlugin)
            connection.plugin(applyVersionKeyPlugin)
            connection.plugin(applyToJsonPlugin)

            return connection
          },
        }
      },
    }),
  ],
  providers: [MongoHealthService, MongoTransactionService],
  exports: [MongooseModule, MongoHealthService, MongoTransactionService],
})
class DatabaseModule {}

export { DatabaseModule }
