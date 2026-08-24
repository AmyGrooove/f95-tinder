import { ApiProperty, ApiSchema } from "@nestjs/swagger"
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"
import { IsNumber, IsString } from "class-validator"
import { Schema as MongooseSchema, Types } from "mongoose"
import type { HydratedDocument } from "mongoose"

@ApiSchema({ name: "Tag", description: "Seeded F95 tag dictionary entry" })
@Schema({ collection: "Tag" })
class Tag {
  @Prop({ type: MongooseSchema.Types.ObjectId })
  @ApiProperty({ description: "Tag identifier", type: String })
  _id!: Types.ObjectId

  @Prop({ type: Number, required: true })
  @ApiProperty({ description: "F95 numeric tag identifier" })
  @IsNumber()
  f95TagId!: number

  @Prop({ type: String, required: true, trim: true })
  @ApiProperty({ description: "Tag name from backend-owned seed map" })
  @IsString()
  name!: string

  @Prop({ type: String, required: true, trim: true })
  @ApiProperty({ description: "Normalized tag slug" })
  @IsString()
  slug!: string

  @ApiProperty({ description: "Creation date" })
  createdAt!: Date

  @ApiProperty({ description: "Update date" })
  updatedAt!: Date
}

const TagSchema = SchemaFactory.createForClass(Tag)

TagSchema.index({ f95TagId: 1 }, { unique: true })

type TagDocument = HydratedDocument<Tag>

export { Tag, type TagDocument, TagSchema }
