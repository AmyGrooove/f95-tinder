import { ApiProperty, ApiSchema } from "@nestjs/swagger"
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"
import { IsString } from "class-validator"
import { Schema as MongooseSchema, Types } from "mongoose"
import type { HydratedDocument } from "mongoose"

@ApiSchema({ name: "Creator", description: "F95 creator dictionary entry" })
@Schema({ collection: "Creator" })
class Creator {
  @Prop({ type: MongooseSchema.Types.ObjectId })
  @ApiProperty({ description: "Creator identifier", type: String })
  _id!: Types.ObjectId

  @Prop({ type: String, required: true, trim: true })
  @ApiProperty({ description: "Creator name" })
  @IsString()
  name!: string

  @Prop({ type: String, required: true, trim: true })
  @ApiProperty({ description: "Normalized creator slug" })
  @IsString()
  slug!: string

  @ApiProperty({ description: "Creation date" })
  createdAt!: Date

  @ApiProperty({ description: "Update date" })
  updatedAt!: Date
}

const CreatorSchema = SchemaFactory.createForClass(Creator)

CreatorSchema.index({ slug: 1 }, { unique: true })

type CreatorDocument = HydratedDocument<Creator>

export { Creator, type CreatorDocument, CreatorSchema }
