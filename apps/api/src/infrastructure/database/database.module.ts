import { Module } from "@nestjs/common"
import { MongooseModule } from "@nestjs/mongoose"

import { InfrastructureConfigModule } from "@infrastructure/config/config.module"
import { InfrastructureConfigService } from "@infrastructure/config/services/config.service"

import { createDatabaseOptions } from "./functions/createDatabaseOptions"
import { MongoHealthService } from "./services/mongoHealth.service"
import { MongoTransactionService } from "./services/mongoTransaction.service"

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
