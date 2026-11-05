import { Module } from "@nestjs/common"
import { MongooseModule } from "@nestjs/mongoose"

import { UserSettings, UserSettingsSchema } from "./schemas/userSettings.schema"
import { UserSettingsRepository } from "@entities/userSettings/services/userSettingsRepository"

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: UserSettings.name, schema: UserSettingsSchema },
    ]),
  ],
  providers: [UserSettingsRepository],
  exports: [UserSettingsRepository],
})
class UserSettingsModule {}

export { UserSettingsModule }
