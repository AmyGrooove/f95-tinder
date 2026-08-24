import { ApiProperty, ApiSchema } from "@nestjs/swagger"
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"
import { IsIn } from "class-validator"
import { Schema as MongooseSchema, Types } from "mongoose"
import type { HydratedDocument } from "mongoose"

import { Game } from "@entities/game/schemas/game.schema"
import { User } from "@entities/user/schemas/user.schema"
import {
  USER_GAME_LIST_TYPES,
  type TUserGameListType,
} from "../types/TUserGameListType"

@ApiSchema({
  name: "UserGameState",
  description: "Per-user game library state",
})
@Schema({ collection: "UserGameState" })
class UserGameState {
  @Prop({ type: MongooseSchema.Types.ObjectId })
  @ApiProperty({ description: "State identifier", type: String })
  _id!: Types.ObjectId

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: User.name, required: true })
  @ApiProperty({ description: "User identifier", type: String })
  userId!: Types.ObjectId

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: Game.name, required: true })
  @ApiProperty({ description: "Game identifier", type: String })
  gameId!: Types.ObjectId

  @Prop({ type: String, enum: USER_GAME_LIST_TYPES, required: true })
  @ApiProperty({
    description: "User library list type",
    enum: USER_GAME_LIST_TYPES,
  })
  @IsIn(USER_GAME_LIST_TYPES)
  listType!: TUserGameListType

  @ApiProperty({ description: "Creation date" })
  createdAt!: Date

  @ApiProperty({ description: "Update date" })
  updatedAt!: Date
}

const UserGameStateSchema = SchemaFactory.createForClass(UserGameState)

UserGameStateSchema.index({ userId: 1, gameId: 1 }, { unique: true })
UserGameStateSchema.index({ userId: 1, listType: 1, updatedAt: -1 })

type UserGameStateDocument = HydratedDocument<UserGameState>

export { UserGameState, type UserGameStateDocument, UserGameStateSchema }
