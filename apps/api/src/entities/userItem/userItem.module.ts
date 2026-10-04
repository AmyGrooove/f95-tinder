import { Module } from "@nestjs/common"
import { MongooseModule } from "@nestjs/mongoose"

import { UserItem, UserItemSchema } from "./schemas/userItem.schema"
import { UserItemRepository } from "./services/userItem.repository"

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: UserItem.name, schema: UserItemSchema },
    ]),
  ],
  providers: [UserItemRepository],
  exports: [UserItemRepository],
})
class UserItemModule {}

export { UserItemModule }
