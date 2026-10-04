import type { TCreateEntity } from "@entities/shared/TCreateEntity"
import { MongoEntity } from "@entities/shared/MongoEntity"
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"
import { Schema as MongooseSchema } from "mongoose"
import type { Types } from "mongoose"

@Schema({
  collection: "userSourceAccounts",
  timestamps: true,
  versionKey: false,
  strict: true,
})
class UserSourceAccount extends MongoEntity {
  @Prop({ type: MongooseSchema.Types.ObjectId, required: true, ref: "User" })
  user: Types.ObjectId

  @Prop({ type: MongooseSchema.Types.ObjectId, required: true, ref: "Source" })
  source: Types.ObjectId

  @Prop({ type: String, required: true })
  externalId: string

  @Prop({ type: String, default: null })
  username: string | null

  @Prop({ type: String, default: null })
  profileUrl: string | null
}

type TCreateUserSourceAccount = TCreateEntity<
  UserSourceAccount,
  "username" | "profileUrl"
>

const UserSourceAccountSchema = SchemaFactory.createForClass(UserSourceAccount)

UserSourceAccountSchema.index(
  { user: 1, source: 1 },
  { name: "user_source_account", unique: true },
)
UserSourceAccountSchema.index(
  { source: 1, externalId: 1 },
  { name: "source_external_account", unique: true },
)

export { UserSourceAccount, UserSourceAccountSchema }
export type { TCreateUserSourceAccount }
