import type { TCreateEntity } from "@entities/shared/TCreateEntity"
import { MongoEntity } from "@entities/shared/MongoEntity"
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"
import { Schema as MongooseSchema } from "mongoose"
import type { Types } from "mongoose"

@Schema({
  collection: "sessions",
  timestamps: true,
  versionKey: false,
  strict: true,
  toJSON: {
    transform: (_document, returnedObject: Record<string, unknown>) => {
      delete returnedObject.refreshTokenHash

      return returnedObject
    },
  },
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

type TCreateSession = TCreateEntity<Session, "userAgent" | "lastUsedAt">

const SessionSchema = SchemaFactory.createForClass(Session)

SessionSchema.index(
  { refreshTokenHash: 1 },
  { name: "session_refresh_token_hash", unique: true },
)
SessionSchema.index({ user: 1, expiresAt: 1 }, { name: "session_user_expiry" })

export { Session, SessionSchema }
export type { TCreateSession }
