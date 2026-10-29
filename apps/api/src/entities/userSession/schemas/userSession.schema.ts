import type { TCreateEntity } from "@infrastructure/database/types/TCreateEntity"
import { MongoEntity } from "@infrastructure/database/types/MongoEntity"
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"
import { Schema as MongooseSchema } from "mongoose"
import type { Types } from "mongoose"
import { ECountry } from "@entities/shared/schemas/ECountry"
import { USER_SESSION_EXPIRY_GRACE_SECONDS } from "../static/USER_SESSION_EXPIRY_GRACE_SECONDS"

@Schema({
  collection: "UserSession",
})
class UserSession extends MongoEntity {
  @Prop({ type: MongooseSchema.Types.ObjectId, required: true, ref: "User" })
  user: Types.ObjectId

  @Prop({ type: String, required: true, select: false })
  refreshTokenHash: string

  @Prop({ type: String, default: null })
  userAgent: string | null

  @Prop({
    type: String,
    enum: ECountry,
    required: true,
    default: ECountry.UNKNOWN,
  })
  country: ECountry

  @Prop({ type: Date, required: true })
  expiresAt: Date

  @Prop({ type: Date, default: null })
  lastRefreshedAt: Date | null
}

type TCreateUserSession = TCreateEntity<
  UserSession,
  "userAgent" | "country" | "lastRefreshedAt"
> &
  Partial<Pick<UserSession, "_id">>

const UserSessionSchema = SchemaFactory.createForClass(UserSession)

UserSessionSchema.index(
  { refreshTokenHash: 1 },
  { name: "userSessionRefreshTokenHashUnique", unique: true },
)
UserSessionSchema.index(
  { user: 1, expiresAt: 1 },
  { name: "userSessionUserExpiryLookup" },
)
UserSessionSchema.index(
  { expiresAt: 1 },
  {
    name: "userSessionExpiryTtl",
    expireAfterSeconds: USER_SESSION_EXPIRY_GRACE_SECONDS,
  },
)

export { UserSession, UserSessionSchema }
export type { TCreateUserSession }
