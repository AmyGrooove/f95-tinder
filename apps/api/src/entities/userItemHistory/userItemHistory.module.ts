import { Module } from "@nestjs/common"
import { MongooseModule } from "@nestjs/mongoose"

import { UserItemHistoryRepository } from "@entities/userItemHistory/services/userItemHistoryRepository"

import {
  UserItemHistory,
  UserItemHistorySchema,
} from "./schemas/userItemHistory.schema"

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: UserItemHistory.name, schema: UserItemHistorySchema },
    ]),
  ],
  providers: [UserItemHistoryRepository],
  exports: [UserItemHistoryRepository],
})
class UserItemHistoryModule {}

export { UserItemHistoryModule }
