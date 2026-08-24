import { ApiProperty, ApiSchema } from "@nestjs/swagger"
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"
import { IsIn, IsNumber, IsString } from "class-validator"
import { Schema as MongooseSchema, Types } from "mongoose"
import type { HydratedDocument } from "mongoose"

import { PREFIX_GROUPS } from "../static/PREFIX_GROUPS"
import type { TPrefixGroup } from "../types/TPrefixGroup"

@ApiSchema({
  name: "Prefix",
  description: "Seeded F95 prefix or engine dictionary entry",
})
@Schema({ collection: "Prefix" })
class Prefix {
  @Prop({ type: MongooseSchema.Types.ObjectId })
  @ApiProperty({ description: "Prefix identifier", type: String })
  _id!: Types.ObjectId

  @Prop({ type: Number, required: true })
  @ApiProperty({ description: "F95 numeric prefix identifier" })
  @IsNumber()
  f95PrefixId!: number

  @Prop({ type: String, required: true, trim: true })
  @ApiProperty({ description: "Prefix name from backend-owned seed map" })
  @IsString()
  name!: string

  @Prop({ type: String, enum: PREFIX_GROUPS, required: true })
  @ApiProperty({ description: "Seed dictionary group", enum: PREFIX_GROUPS })
  @IsIn(PREFIX_GROUPS)
  group!: TPrefixGroup

  @Prop({ type: String, required: true, trim: true })
  @ApiProperty({ description: "Normalized prefix slug" })
  @IsString()
  slug!: string

  @ApiProperty({ description: "Creation date" })
  createdAt!: Date

  @ApiProperty({ description: "Update date" })
  updatedAt!: Date
}

const PrefixSchema = SchemaFactory.createForClass(Prefix)

PrefixSchema.index({ f95PrefixId: 1 }, { unique: true })

type PrefixDocument = HydratedDocument<Prefix>

export { Prefix, type PrefixDocument, PrefixSchema }
