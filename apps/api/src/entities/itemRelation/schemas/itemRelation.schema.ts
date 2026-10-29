import type { TCreateEntity } from "@infrastructure/database/types/TCreateEntity"
import { MongoEntity } from "@infrastructure/database/types/MongoEntity"
import type { TCreateItemRelationSide } from "./itemRelationSide.schema"
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"
import type { ItemRelationSide } from "./itemRelationSide.schema"
import { ItemRelationSideSchema } from "./itemRelationSide.schema"

@Schema({ collection: "ItemRelation" })
class ItemRelation extends MongoEntity {
  @Prop({ type: ItemRelationSideSchema, required: true })
  first: ItemRelationSide

  @Prop({ type: ItemRelationSideSchema, required: true })
  second: ItemRelationSide
}

type TCreateItemRelation = TCreateEntity<
  ItemRelation,
  never,
  {
    first: TCreateItemRelationSide
    second: TCreateItemRelationSide
  }
>

const ItemRelationSchema = SchemaFactory.createForClass(ItemRelation)

ItemRelationSchema.index(
  { "first.item": 1, "first.role": 1 },
  { name: "itemRelationFirstLookup" },
)
ItemRelationSchema.index(
  { "second.item": 1, "second.role": 1 },
  { name: "itemRelationSecondLookup" },
)

export { ItemRelation, ItemRelationSchema }
export type { TCreateItemRelation }
