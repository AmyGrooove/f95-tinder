import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"
import { Schema as MongooseSchema } from "mongoose"
import type { Types } from "mongoose"

import { MongoEntity } from "@infrastructure/database/types/MongoEntity"
import type { TCreateEntity } from "@infrastructure/database/types/TCreateEntity"
import { isInt } from "@shared/functions/checks/isInt"
import { isNonNegativeSafe } from "@shared/functions/checks/isNonNegativeSafe"
import { isString } from "@shared/functions/checks/isString"

@Schema({ collection: "CollectionItem" })
class CollectionItem extends MongoEntity {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    required: true,
    ref: "Collection",
  })
  collection: Types.ObjectId

  @Prop({ type: MongooseSchema.Types.ObjectId, required: true, ref: "Item" })
  item: Types.ObjectId

  @Prop({
    type: Number,
    required: true,
    validate: (value: unknown) => isInt(value) && isNonNegativeSafe(value),
  })
  position: number

  @Prop({
    type: String,
    default: null,
    trim: true,
    set: (value: unknown) =>
      isString(value) && value.trim() === "" ? null : value,
  })
  note: string | null

  @Prop({ type: MongooseSchema.Types.ObjectId, default: null })
  groupId: Types.ObjectId | null
}

type TCreateCollectionItem = TCreateEntity<CollectionItem, "note" | "groupId">

const CollectionItemSchema = SchemaFactory.createForClass(CollectionItem)

CollectionItemSchema.index(
  { collection: 1, item: 1 },
  { name: "collectionItemUnique", unique: true },
)
CollectionItemSchema.index(
  { collection: 1, groupId: 1, position: 1, _id: 1 },
  { name: "collectionGroupItemsLookup" },
)
CollectionItemSchema.index(
  { item: 1, collection: 1 },
  { name: "itemCollectionsLookup" },
)

export { CollectionItem, CollectionItemSchema }
export type { TCreateCollectionItem }
