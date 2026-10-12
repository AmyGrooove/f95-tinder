import { ETagRelationType } from "./ETagRelationType"
import type { TCreateEntity } from "@infrastructure/database/types/TCreateEntity"
import { MongoEntity } from "@infrastructure/database/types/MongoEntity"
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"
import { Schema as MongooseSchema } from "mongoose"
import type { Types } from "mongoose"

@Schema({
  collection: "TagRelation",
})
class TagRelation extends MongoEntity {
  @Prop({ type: MongooseSchema.Types.ObjectId, required: true, ref: "Tag" })
  from: Types.ObjectId

  @Prop({ type: MongooseSchema.Types.ObjectId, required: true, ref: "Tag" })
  to: Types.ObjectId

  @Prop({ type: String, enum: Object.values(ETagRelationType), required: true })
  type: ETagRelationType
}

type TCreateTagRelation = TCreateEntity<TagRelation>

const TagRelationSchema = SchemaFactory.createForClass(TagRelation)

TagRelationSchema.index(
  { from: 1, type: 1, to: 1 },
  { name: "tagRelationFromTypeTo", unique: true },
)
TagRelationSchema.index(
  { to: 1, type: 1, from: 1 },
  { name: "tagRelationToTypeFrom" },
)

export { TagRelation, TagRelationSchema }
export type { TCreateTagRelation }
