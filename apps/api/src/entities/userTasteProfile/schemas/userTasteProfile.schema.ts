import type { TCreateEntity } from "@infrastructure/database/types/TCreateEntity"
import { MongoEntity } from "@infrastructure/database/types/MongoEntity"
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"
import { isArray } from "@shared/functions/checks/isArray"
import { isNil } from "@shared/functions/checks/isNil"
import { Schema as MongooseSchema } from "mongoose"
import type { Types } from "mongoose"
import { removeEmptyTastePreferences } from "../functions/removeEmptyTastePreferences"
import { MAX_TAG_PREFERENCES } from "../static/MAX_TAG_PREFERENCES"
import type {
  TasteTagPreference,
  TCreateTasteTagPreference,
} from "./tasteTagPreference.schema"
import { TasteTagPreferenceSchema } from "./tasteTagPreference.schema"

@Schema({ collection: "UserTasteProfile" })
class UserTasteProfile extends MongoEntity {
  @Prop({ type: MongooseSchema.Types.ObjectId, required: true, ref: "User" })
  user: Types.ObjectId

  @Prop({
    required: true,
    type: [TasteTagPreferenceSchema],
    default: [],
    set: removeEmptyTastePreferences<TasteTagPreference>,
    validate: (value: TasteTagPreference[]) =>
      isArray(value) &&
      value.every((entry) => !isNil(entry)) &&
      value.length <= MAX_TAG_PREFERENCES &&
      new Set(value.map((entry) => String(entry.tag))).size === value.length,
  })
  tagPreferences: TasteTagPreference[]
}

type TCreateUserTasteProfile = TCreateEntity<
  UserTasteProfile,
  never,
  {
    tagPreferences?: TCreateTasteTagPreference[]
  }
>

const UserTasteProfileSchema = SchemaFactory.createForClass(UserTasteProfile)

UserTasteProfileSchema.index(
  { user: 1 },
  { name: "userTasteProfileUnique", unique: true },
)

UserTasteProfileSchema.pre("validate", function () {
  this.tagPreferences = removeEmptyTastePreferences(this.tagPreferences)
})

export { UserTasteProfile, UserTasteProfileSchema }
export type { TCreateUserTasteProfile }
