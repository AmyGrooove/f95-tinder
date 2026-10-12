import type { TCreateEntity } from "@infrastructure/database/types/TCreateEntity"
import { MongoEntity } from "@infrastructure/database/types/MongoEntity"
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"
import { Schema as MongooseSchema } from "mongoose"
import type { Types } from "mongoose"

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
  lastUsedAt: Date | null
}

type TCreateSession = TCreateEntity<Session, "userAgent" | "lastUsedAt"> &
  Partial<Pick<Session, "_id">>

const SessionSchema = SchemaFactory.createForClass(Session)

SessionSchema.index(
  { refreshTokenHash: 1 },
  { name: "sessionRefreshTokenHash", unique: true },
)
SessionSchema.index({ user: 1, expiresAt: 1 }, { name: "sessionUserExpiresAt" })

export { Session, SessionSchema }
export type { TCreateSession }
