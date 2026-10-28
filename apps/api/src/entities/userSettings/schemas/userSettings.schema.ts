import { ELocale } from "./ELocale"
import type { TCreateEntity } from "@infrastructure/database/types/TCreateEntity"
import { MongoEntity } from "@infrastructure/database/types/MongoEntity"
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"
import { Schema as MongooseSchema } from "mongoose"
import type { Types } from "mongoose"

@Schema({ collection: "UserSettings" })
class UserSettings extends MongoEntity {
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

type TCreateUserSettings = TCreateEntity<UserSettings, "locale">

const UserSettingsSchema = SchemaFactory.createForClass(UserSettings)

UserSettingsSchema.index(
  { user: 1 },
  { name: "userSettingsUnique", unique: true },
)

export { UserSettings, UserSettingsSchema }
export type { TCreateUserSettings }
