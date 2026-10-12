import type { TCreateEntity } from "@infrastructure/database/types/TCreateEntity"
import { MongoEntity } from "@infrastructure/database/types/MongoEntity"
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"
import { Schema as MongooseSchema } from "mongoose"
import type { Types } from "mongoose"
import { SESSION_EXPIRY_GRACE_SECONDS } from "../static/SESSION_EXPIRY_GRACE_SECONDS"

@Schema({
  collection: "Session",
})
class Session extends MongoEntity {
  @Prop({ type: MongooseSchema.Types.ObjectId, required: true, ref: "User" })
  user: Types.ObjectId

  @Prop({ type: String, required: true, select: false })
  refreshTokenHash: string

  @Prop({ type: String, default: null })
  userAgent: string | null

  @Prop({ type: Date, required: true })
  expiresAt: Date

  @Prop({ type: Date, default: null })
  lastRefreshedAt: Date | null
}

type TCreateSession = TCreateEntity<Session, "userAgent" | "lastRefreshedAt"> &
  Partial<Pick<Session, "_id">>

const SessionSchema = SchemaFactory.createForClass(Session)

SessionSchema.index(
  { refreshTokenHash: 1 },
  { name: "sessionRefreshTokenHashUnique", unique: true },
)
SessionSchema.index(
  { user: 1, expiresAt: 1 },
  { name: "sessionUserExpiryLookup" },
)
SessionSchema.index(
  { expiresAt: 1 },
  {
    name: "sessionExpiryTtl",
    expireAfterSeconds: SESSION_EXPIRY_GRACE_SECONDS,
  },
)

export { Session, SessionSchema }
export type { TCreateSession }
