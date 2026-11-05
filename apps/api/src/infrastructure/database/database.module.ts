import { Module } from "@nestjs/common"
import { MongooseModule } from "@nestjs/mongoose"

import { InfrastructureConfigModule } from "@infrastructure/config/config.module"
import { InfrastructureConfigService } from "@infrastructure/config/services/configService"

import { createDatabaseOptions } from "./functions/createDatabaseOptions"
import { MongoHealthService } from "@infrastructure/database/services/mongoHealthService"
import { MongoTransactionService } from "@infrastructure/database/services/mongoTransactionService"

@Module({
  imports: [
    MongooseModule.forRootAsync({
      imports: [InfrastructureConfigModule],
      inject: [InfrastructureConfigService],
      useFactory: createDatabaseOptions,
    }),
  ],
  providers: [MongoHealthService, MongoTransactionService],
  exports: [MongooseModule, MongoHealthService, MongoTransactionService],
})
class DatabaseModule {}

export { DatabaseModule }
