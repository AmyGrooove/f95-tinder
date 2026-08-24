import { ApiProperty, ApiSchema } from "@nestjs/swagger"
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"
import { IsDate, IsString } from "class-validator"
import { Schema as MongooseSchema, Types } from "mongoose"
import type { HydratedDocument } from "mongoose"

import { User } from "@entities/user/schemas/user.schema"

@ApiSchema({ name: "Session", description: "User refresh token session" })
@Schema({ collection: "Session" })
class Session {
  @Prop({ type: MongooseSchema.Types.ObjectId })
  @ApiProperty({ description: "Session identifier", type: String })
  _id!: Types.ObjectId

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: User.name, required: true })
  @ApiProperty({ description: "User identifier", type: String })
  userId!: Types.ObjectId

  @Prop({ type: String, required: true })
  @ApiProperty({ description: "Refresh token hash" })
  @IsString()
  refreshTokenHash!: string

  @Prop({ type: Date, required: true })
  @ApiProperty({ description: "Refresh token expiration date" })
  @IsDate()
  expiresAt!: Date

  @ApiProperty({ description: "Creation date" })
  createdAt!: Date
}

const SessionSchema = SchemaFactory.createForClass(Session)

SessionSchema.index({ userId: 1 })

type SessionDocument = HydratedDocument<Session>

export { Session, type SessionDocument, SessionSchema }
