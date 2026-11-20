import { Module } from "@nestjs/common"
import { MongooseModule } from "@nestjs/mongoose"

import {
  UserItemHistory,
  UserItemHistorySchema,
} from "./schemas/userItemHistory.schema"
import { UserItemHistoryRepository } from "./services/userItemHistoryRepository"

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
