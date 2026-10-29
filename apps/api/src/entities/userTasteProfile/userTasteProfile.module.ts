import { Module } from "@nestjs/common"
import { MongooseModule } from "@nestjs/mongoose"

import { TagItemModule } from "@entities/tagItem/tagItem.module"
import { UserModule } from "@entities/user/user.module"
import { UserItemModule } from "@entities/userItem/userItem.module"
import { JobsModule } from "@infrastructure/jobs/jobs.module"

import {
  UserTasteProfile,
  UserTasteProfileSchema,
} from "./schemas/userTasteProfile.schema"
import { UserTasteProfileRepository } from "./services/userTasteProfile.repository"
import { UserTasteProfileRecalculationService } from "./services/userTasteProfileRecalculation.service"
import { RecalculateUserTasteProfileJobHandler } from "./handlers/recalculateUserTasteProfileJob.handler"

@Module({
  imports: [
    TagItemModule,
    UserModule,
    UserItemModule,
    JobsModule,
    MongooseModule.forFeature([
      { name: UserTasteProfile.name, schema: UserTasteProfileSchema },
    ]),
  ],
  providers: [
    UserTasteProfileRepository,
    UserTasteProfileRecalculationService,
    RecalculateUserTasteProfileJobHandler,
  ],
  exports: [UserTasteProfileRepository, UserTasteProfileRecalculationService],
})
class UserTasteProfileModule {}

export { UserTasteProfileModule }
