import { Module } from "@nestjs/common"
import { MongooseModule } from "@nestjs/mongoose"

import {
  UserTasteProfile,
  UserTasteProfileSchema,
} from "./schemas/userTasteProfile.schema"
import { UserTasteProfileRepository } from "./services/userTasteProfile.repository"

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: UserTasteProfile.name, schema: UserTasteProfileSchema },
    ]),
  ],
  providers: [UserTasteProfileRepository],
  exports: [UserTasteProfileRepository],
})
class UserTasteProfileModule {}

export { UserTasteProfileModule }
