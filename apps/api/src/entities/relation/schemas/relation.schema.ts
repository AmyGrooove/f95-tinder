import type { TCreateEntity } from "@entities/shared/TCreateEntity"
import { MongoEntity } from "@entities/shared/MongoEntity"
import type { TCreateRelationSide } from "./relationSide.schema"
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"
import type { RelationSide } from "./relationSide.schema"
import { RelationSideSchema } from "./relationSide.schema"

@Schema({
  collection: "relations",
  timestamps: true,
  versionKey: false,
  strict: true,
})
class Relation extends MongoEntity {
  @Prop({ type: RelationSideSchema, required: true })
  first: RelationSide

  @Prop({ type: RelationSideSchema, required: true })
  second: RelationSide
}

type TCreateRelation = TCreateEntity<
  Relation,
  never,
  {
    first: TCreateRelationSide
    second: TCreateRelationSide
  }
>

const RelationSchema = SchemaFactory.createForClass(Relation)

RelationSchema.index(
  { "first.item.type": 1, "first.item.id": 1, "first.role": 1 },
  { name: "relation_first_item_role" },
)
RelationSchema.index(
  { "second.item.type": 1, "second.item.id": 1, "second.role": 1 },
  { name: "relation_second_item_role" },
)

export { Relation, RelationSchema }
export type { TCreateRelation }
