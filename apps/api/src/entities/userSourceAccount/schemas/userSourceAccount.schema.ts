import type { TCreateEntity } from "@infrastructure/database/types/TCreateEntity"
import { MongoEntity } from "@infrastructure/database/types/MongoEntity"
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"
import { Schema as MongooseSchema } from "mongoose"
import type { Types } from "mongoose"

@Schema({ collection: "UserSourceAccount" })
class UserSourceAccount extends MongoEntity {
  @Prop({ type: MongooseSchema.Types.ObjectId, required: true, ref: "User" })
  user: Types.ObjectId

  @Prop({ type: MongooseSchema.Types.ObjectId, required: true, ref: "Source" })
  source: Types.ObjectId

  @Prop({ type: String, required: true })
  externalId: string
}

type TCreateUserSourceAccount = TCreateEntity<UserSourceAccount>

const UserSourceAccountSchema = SchemaFactory.createForClass(UserSourceAccount)

UserSourceAccountSchema.index(
  { user: 1, source: 1 },
  { name: "userSourceUnique", unique: true },
)
UserSourceAccountSchema.index(
  { source: 1, externalId: 1 },
  { name: "sourceAccountUnique", unique: true },
)

export { UserSourceAccount, UserSourceAccountSchema }
export type { TCreateUserSourceAccount }
