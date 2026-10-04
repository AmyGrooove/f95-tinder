import type { TCreateEntity } from "@entities/shared/TCreateEntity"
import { MongoEntity } from "@entities/shared/MongoEntity"
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"
import { Schema as MongooseSchema } from "mongoose"
import type { Types } from "mongoose"

@Schema({
  collection: "tagRelations",
  timestamps: true,
  versionKey: false,
  strict: true,
})
class TagRelation extends MongoEntity {
  @Prop({ type: MongooseSchema.Types.ObjectId, required: true, ref: "Tag" })
  from: Types.ObjectId

  @Prop({ type: MongooseSchema.Types.ObjectId, required: true, ref: "Tag" })
  to: Types.ObjectId

  @Prop({ type: String, required: true })
  type: string
}

type TCreateTagRelation = TCreateEntity<TagRelation>

const TagRelationSchema = SchemaFactory.createForClass(TagRelation)

TagRelationSchema.index(
  { from: 1, type: 1, to: 1 },
  { name: "tag_relation_from_type_to", unique: true },
)
TagRelationSchema.index(
  { to: 1, type: 1, from: 1 },
  { name: "tag_relation_to_type_from" },
)

export { TagRelation, TagRelationSchema }
export type { TCreateTagRelation }
