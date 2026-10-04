import type { TCreateEntity } from "@entities/shared/TCreateEntity"
import { MongoEntity } from "@entities/shared/MongoEntity"
import type { TCreateTasteItemTypeProfile } from "./tasteItemTypeProfile.schema"
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"
import { isArray } from "@shared/functions/checks/isArray"
import { isNil } from "@shared/functions/checks/isNil"
import { Schema as MongooseSchema } from "mongoose"
import type { Types } from "mongoose"
import type { TasteItemTypeProfile } from "./tasteItemTypeProfile.schema"
import { TasteItemTypeProfileSchema } from "./tasteItemTypeProfile.schema"

@Schema({
  collection: "userTasteProfiles",
  timestamps: true,
  versionKey: false,
  strict: true,
})
class UserTasteProfile extends MongoEntity {
  @Prop({ type: MongooseSchema.Types.ObjectId, required: true, ref: "User" })
  user: Types.ObjectId

  @Prop({
    required: true,
    type: [TasteItemTypeProfileSchema],
    default: [],
    validate: (value: unknown) =>
      isArray(value) && value.every((entry) => !isNil(entry)),
  })
  profiles: TasteItemTypeProfile[]
}

type TCreateUserTasteProfile = TCreateEntity<
  UserTasteProfile,
  never,
  {
    profiles?: TCreateTasteItemTypeProfile[]
  }
>

const UserTasteProfileSchema = SchemaFactory.createForClass(UserTasteProfile)

UserTasteProfileSchema.index(
  { user: 1 },
  { name: "taste_profile_user", unique: true },
)

export { UserTasteProfile, UserTasteProfileSchema }
export type { TCreateUserTasteProfile }
