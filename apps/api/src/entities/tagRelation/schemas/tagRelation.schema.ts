import { ETagRelationType } from "./ETagRelationType"
import type { TCreateEntity } from "@infrastructure/database/types/TCreateEntity"
import { MongoEntity } from "@infrastructure/database/types/MongoEntity"
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"
import { Schema as MongooseSchema } from "mongoose"
import type { Types } from "mongoose"
import { DICTIONARY } from "@entities/shared/static/DICTIONARY"

@Schema({
  collection: "TagRelation",
})
class TagRelation extends MongoEntity {
  @Prop({ type: MongooseSchema.Types.ObjectId, required: true, ref: "Tag" })
  first: Types.ObjectId

  @Prop({ type: MongooseSchema.Types.ObjectId, required: true, ref: "Tag" })
  second: Types.ObjectId

  @Prop({ type: String, enum: Object.values(ETagRelationType), required: true })
  type: ETagRelationType
}

type TCreateTagRelation = TCreateEntity<TagRelation>

const TagRelationSchema = SchemaFactory.createForClass(TagRelation)

TagRelationSchema.pre("validate", function () {
  if (this.first?.equals(this.second)) {
    this.invalidate("second", DICTIONARY.tagRelation.selfRelation)
  }
})

TagRelationSchema.index(
  { first: 1, type: 1, second: 1 },
  { name: "tagRelationUnique", unique: true },
)
TagRelationSchema.index(
  { second: 1, type: 1, first: 1 },
  { name: "tagRelationSecondLookup" },
)

export { TagRelation, TagRelationSchema }
export type { TCreateTagRelation }
