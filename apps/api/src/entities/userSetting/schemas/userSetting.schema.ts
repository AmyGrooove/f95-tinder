import { ELocale } from "./ELocale"
import type { TCreateEntity } from "@infrastructure/database/types/TCreateEntity"
import { MongoEntity } from "@infrastructure/database/types/MongoEntity"
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"
import { Schema as MongooseSchema } from "mongoose"
import type { Types } from "mongoose"

@Schema({ collection: "UserSetting" })
class UserSetting extends MongoEntity {
  @Prop({
    type: String,
    enum: Object.values(ELocale),
    required: true,
    default: ELocale.RU,
  })
  locale: ELocale

  @Prop({ type: MongooseSchema.Types.ObjectId, required: true, ref: "User" })
  user: Types.ObjectId
}

type TCreateUserSetting = TCreateEntity<UserSetting, "locale">

const UserSettingSchema = SchemaFactory.createForClass(UserSetting)

UserSettingSchema.index(
  { user: 1 },
  { name: "userSettingUnique", unique: true },
)

export { UserSetting, UserSettingSchema }
export type { TCreateUserSetting }
