import { ApiProperty, ApiPropertyOptional, ApiSchema } from "@nestjs/swagger"
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"
import {
  IsArray,
  IsDate,
  IsNumber,
  IsOptional,
  IsString,
} from "class-validator"
import { Schema as MongooseSchema, Types } from "mongoose"
import type { HydratedDocument } from "mongoose"

import { Creator } from "@entities/creator/schemas/creator.schema"
import { Prefix } from "@entities/prefix/schemas/prefix.schema"
import { Tag } from "@entities/tag/schemas/tag.schema"

@ApiSchema({ name: "Game", description: "F95 catalog game" })
@Schema({ collection: "Game" })
class Game {
  @Prop({ type: MongooseSchema.Types.ObjectId })
  @ApiProperty({ description: "Game identifier", type: String })
  _id!: Types.ObjectId

  @Prop({ type: Number, required: true })
  @ApiProperty({ description: "F95 thread identifier" })
  @IsNumber()
  f95ThreadId!: number

  @Prop({ type: String, required: true, trim: true })
  @ApiProperty({ description: "F95 thread URL" })
  @IsString()
  threadUrl!: string

  @Prop({ type: String, required: true, trim: true })
  @ApiProperty({ description: "Game title" })
  @IsString()
  title!: string

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: Creator.name,
    required: true,
  })
  @ApiProperty({ description: "Creator identifier", type: String })
  creatorId!: Types.ObjectId

  @Prop({ type: String, required: true, trim: true })
  @ApiProperty({ description: "Game version" })
  @IsString()
  version!: string

  @Prop({ type: String, default: null, trim: true })
  @ApiPropertyOptional({ description: "Cover image URL", nullable: true })
  @IsOptional()
  @IsString()
  coverUrl!: string | null

  @Prop({ type: [String], default: [] })
  @ApiProperty({ description: "Screenshot URLs", type: [String] })
  @IsArray()
  @IsString({ each: true })
  screenshotUrls!: string[]

  @Prop({ type: Date, default: null })
  @ApiPropertyOptional({ description: "F95 update date", nullable: true })
  @IsOptional()
  @IsDate()
  f95UpdatedAt!: Date | null

  @Prop({ type: [MongooseSchema.Types.ObjectId], ref: Tag.name, default: [] })
  @ApiProperty({ description: "Seeded tag identifiers", type: [String] })
  @IsArray()
  tagIds!: Types.ObjectId[]

  @Prop({
    type: [MongooseSchema.Types.ObjectId],
    ref: Prefix.name,
    default: [],
  })
  @ApiProperty({ description: "Seeded prefix identifiers", type: [String] })
  @IsArray()
  prefixIds!: Types.ObjectId[]

  @ApiProperty({ description: "Creation date" })
  createdAt!: Date

  @ApiProperty({ description: "Update date" })
  updatedAt!: Date
}

const GameSchema = SchemaFactory.createForClass(Game)

GameSchema.index({ f95ThreadId: 1 }, { unique: true })
GameSchema.index({ f95UpdatedAt: -1 })
GameSchema.index({ creatorId: 1 })

type GameDocument = HydratedDocument<Game>

export { Game, type GameDocument, GameSchema }
