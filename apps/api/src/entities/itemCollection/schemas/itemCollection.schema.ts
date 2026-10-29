import { normalizeEmptyStringToNull } from "@entities/shared/functions/setters/normalizeEmptyStringToNull"
import { checkIsNonNegativeSafeInteger } from "@entities/shared/functions/checks/checkIsNonNegativeSafeInteger"
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"
import { Schema as MongooseSchema } from "mongoose"
import type { Types } from "mongoose"

import { MongoEntity } from "@infrastructure/database/types/MongoEntity"
import type { TCreateEntity } from "@infrastructure/database/types/TCreateEntity"
import { isNil } from "@shared/functions/checks/isNil"
import { isFiniteNumber } from "@shared/functions/checks/isFiniteNumber"

@Schema({ collection: "ItemCollection" })
class ItemCollection extends MongoEntity {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    required: true,
    ref: "Collection",
  })
  collectionId: Types.ObjectId

  @Prop({ type: MongooseSchema.Types.ObjectId, required: true, ref: "Item" })
  item: Types.ObjectId

  @Prop({
    type: Number,
    required: true,
    validate: checkIsNonNegativeSafeInteger,
  })
  position: number

  @Prop({
    type: Number,
    default: null,
    validate: (value: unknown) =>
      isNil(value) || (isFiniteNumber(value) && value > 0 && value <= 1),
  })
  relevanceScore: number | null

  @Prop({
    type: String,
    default: null,
    trim: true,
    set: normalizeEmptyStringToNull,
  })
  note: string | null

  @Prop({ type: MongooseSchema.Types.ObjectId, required: true })
  groupId: Types.ObjectId
}

type TCreateItemCollection = TCreateEntity<
  ItemCollection,
  "note" | "relevanceScore"
>

const ItemCollectionSchema = SchemaFactory.createForClass(ItemCollection)

ItemCollectionSchema.index(
  { collectionId: 1, item: 1 },
  { name: "itemCollectionUnique", unique: true },
)
ItemCollectionSchema.index(
  { collectionId: 1, groupId: 1, position: 1, _id: 1 },
  { name: "collectionGroupItemsLookup" },
)
ItemCollectionSchema.index(
  { item: 1, collectionId: 1 },
  { name: "itemCollectionsLookup" },
)

export { ItemCollection, ItemCollectionSchema }
export type { TCreateItemCollection }
