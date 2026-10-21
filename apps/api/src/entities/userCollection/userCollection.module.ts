import { Module } from "@nestjs/common"
import { MongooseModule } from "@nestjs/mongoose"

import {
  UserCollection,
  UserCollectionSchema,
} from "./schemas/userCollection.schema"
import { UserCollectionRepository } from "./services/userCollection.repository"

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: UserCollection.name, schema: UserCollectionSchema },
    ]),
  ],
  providers: [UserCollectionRepository],
  exports: [UserCollectionRepository],
})
class UserCollectionModule {}

export { UserCollectionModule }
