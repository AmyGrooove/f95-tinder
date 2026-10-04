import { Module } from "@nestjs/common"
import { MongooseModule } from "@nestjs/mongoose"

import { UserSetting, UserSettingSchema } from "./schemas/userSetting.schema"
import { UserSettingRepository } from "./services/userSetting.repository"

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: UserSetting.name, schema: UserSettingSchema },
    ]),
  ],
  providers: [UserSettingRepository],
  exports: [UserSettingRepository],
})
class UserSettingModule {}

export { UserSettingModule }
