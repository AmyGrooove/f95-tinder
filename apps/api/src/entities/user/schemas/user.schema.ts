import type { TCreateEntity } from "@infrastructure/database/types/TCreateEntity"
import { MongoEntity } from "@infrastructure/database/types/MongoEntity"
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"
import { isArray } from "@shared/functions/checks/isArray"
import { isNil } from "@shared/functions/checks/isNil"
import { isString } from "@shared/functions/checks/isString"
import { EUserRole } from "./EUserRole"
import type { LinkedAccount } from "./linkedAccount.schema"
import { LinkedAccountSchema } from "./linkedAccount.schema"
import { USERNAME_REGEX } from "../static/USERNAME_REGEX"

@Schema({ collection: "User" })
class User extends MongoEntity {
  @Prop({
    type: String,
    default: null,
    trim: true,
    lowercase: true,
    set: (value: unknown) =>
      isString(value) && value.trim() === "" ? null : value,
  })
  email: string | null

  @Prop({
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    match: USERNAME_REGEX,
  })
  username: string

  @Prop({ type: String, required: true, trim: true })
  displayName: string

  @Prop({ type: String, default: null })
  avatarUrl: string | null

  @Prop({ type: String, default: null, select: false })
  passwordHash: string | null

  @Prop({ type: String, default: null, select: false })
  accessCodeHash: string | null

  @Prop({
    required: true,
    type: String,
    enum: Object.values(EUserRole),
    default: EUserRole.USER,
  })
  role: EUserRole

  @Prop({
    required: true,
    type: [LinkedAccountSchema],
    default: [],
    validate: (value: LinkedAccount[]) =>
      isArray(value) &&
      value.every((entry) => !isNil(entry)) &&
      new Set(value.map((entry) => entry.provider)).size === value.length,
  })
  linkedAccounts: LinkedAccount[]
}

type TCreateUser = TCreateEntity<
  User,
  | "email"
  | "avatarUrl"
  | "passwordHash"
  | "accessCodeHash"
  | "role"
  | "linkedAccounts"
> &
  Partial<Pick<User, "_id">>

const UserSchema = SchemaFactory.createForClass(User)

UserSchema.set("toJSON", {
  transform: (_document, returnedObject: Partial<User>) => {
    delete returnedObject.passwordHash
    delete returnedObject.accessCodeHash

    return returnedObject
  },
})

UserSchema.index({ username: 1 }, { name: "userUsernameUnique", unique: true })
UserSchema.index(
  { email: 1 },
  {
    name: "userEmailUnique",
    unique: true,
    partialFilterExpression: { email: { $type: "string" } },
  },
)
UserSchema.index(
  { "linkedAccounts.provider": 1, "linkedAccounts.externalId": 1 },
  {
    name: "userLinkedAccountUnique",
    unique: true,
    partialFilterExpression: {
      "linkedAccounts.provider": { $type: "string" },
      "linkedAccounts.externalId": { $type: "string" },
    },
  },
)

export { User, UserSchema }
export type { TCreateUser }
