import type { TCreateEntity } from "@entities/shared/TCreateEntity"
import { MongoEntity } from "@entities/shared/MongoEntity"
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"
import { isArray } from "@shared/functions/checks/isArray"
import { isNil } from "@shared/functions/checks/isNil"
import { isString } from "@shared/functions/checks/isString"
import { EUserType } from "./EUserType"
import { EUserRole } from "./EUserRole"
import type { LinkedAccount } from "./linkedAccount.schema"
import { LinkedAccountSchema } from "./linkedAccount.schema"

@Schema({
  collection: "users",
  timestamps: true,
  versionKey: false,
  strict: true,
  toJSON: {
    transform: (_document, returnedObject: Record<string, unknown>) => {
      delete returnedObject.passwordHash
      delete returnedObject.temporaryCodeHash

      return returnedObject
    },
  },
})
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

  @Prop({ type: Date, default: null })
  emailVerifiedAt: Date | null

  @Prop({ type: String, required: true, trim: true, lowercase: true })
  username: string

  @Prop({ type: String, required: true })
  displayName: string

  @Prop({ type: String, default: null })
  avatarUrl: string | null

  @Prop({
    required: true,
    type: String,
    enum: Object.values(EUserType),
    default: EUserType.TEMPORARY,
  })
  type: EUserType

  @Prop({ type: String, default: null, select: false })
  passwordHash: string | null

  @Prop({ type: String, default: null, select: false })
  temporaryCodeHash: string | null

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

  @Prop({ type: String, required: true })
  locale: string
}

type TCreateUser = TCreateEntity<
  User,
  | "email"
  | "emailVerifiedAt"
  | "avatarUrl"
  | "type"
  | "passwordHash"
  | "temporaryCodeHash"
  | "role"
  | "linkedAccounts"
>

const UserSchema = SchemaFactory.createForClass(User)

UserSchema.index({ username: 1 }, { name: "user_username", unique: true })
UserSchema.index(
  { email: 1 },
  {
    name: "user_email",
    unique: true,
    partialFilterExpression: { email: { $type: "string" } },
  },
)
UserSchema.index(
  { "linkedAccounts.provider": 1, "linkedAccounts.externalId": 1 },
  {
    name: "user_linked_account",
    unique: true,
    partialFilterExpression: {
      "linkedAccounts.provider": { $type: "string" },
      "linkedAccounts.externalId": { $type: "string" },
    },
  },
)

export { User, UserSchema }
export type { TCreateUser }
