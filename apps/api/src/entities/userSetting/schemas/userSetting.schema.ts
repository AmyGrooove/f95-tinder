import type { TCreateEntity } from "@entities/shared/TCreateEntity"
import { MongoEntity } from "@entities/shared/MongoEntity"
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"
import { Schema as MongooseSchema } from "mongoose"
import type { Types } from "mongoose"

@Schema({
  collection: "userSettings",
  timestamps: true,
  versionKey: false,
  strict: true,
})
class UserSetting extends MongoEntity {
  @Prop({ type: MongooseSchema.Types.ObjectId, required: true, ref: "User" })
  user: Types.ObjectId
}

type TCreateUserSetting = TCreateEntity<UserSetting>

const UserSettingSchema = SchemaFactory.createForClass(UserSetting)

UserSettingSchema.index({ user: 1 }, { name: "setting_user", unique: true })

export { UserSetting, UserSettingSchema }
export type { TCreateUserSetting }
