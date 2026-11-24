import { Module } from "@nestjs/common"
import { MongooseModule } from "@nestjs/mongoose"

import { UserActivity, UserActivitySchema } from "./schemas/userActivity.schema"
import { UserActivityRepository } from "./services/userActivityRepository"

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: UserActivity.name, schema: UserActivitySchema },
    ]),
  ],
  providers: [UserActivityRepository],
  exports: [UserActivityRepository],
})
class UserActivityModule {}

export { UserActivityModule }
