import { checkIsUniqueObjectIdArray } from "@entities/shared/functions/checks/checkIsUniqueObjectIdArray"
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"
import { Schema as MongooseSchema } from "mongoose"
import type { Types } from "mongoose"

import type { TCreateEntity } from "@infrastructure/database/types/TCreateEntity"

@Schema({ _id: false, id: false, timestamps: false })
class CollectionTagRules {
  @Prop({
    type: [{ type: MongooseSchema.Types.ObjectId, ref: "Tag" }],
    required: true,
    default: [],
    validate: checkIsUniqueObjectIdArray,
  })
  all: Types.ObjectId[]

  @Prop({
    type: [{ type: MongooseSchema.Types.ObjectId, ref: "Tag" }],
    required: true,
    default: [],
    validate: checkIsUniqueObjectIdArray,
  })
  any: Types.ObjectId[]

  @Prop({
    type: [{ type: MongooseSchema.Types.ObjectId, ref: "Tag" }],
    required: true,
    default: [],
    validate: checkIsUniqueObjectIdArray,
  })
  exclude: Types.ObjectId[]
}

type TCreateCollectionTagRules = TCreateEntity<
  CollectionTagRules,
  "all" | "any" | "exclude"
>

const CollectionTagRulesSchema =
  SchemaFactory.createForClass(CollectionTagRules)

export { CollectionTagRules, CollectionTagRulesSchema }
export type { TCreateCollectionTagRules }
