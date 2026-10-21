import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"
import { Schema as MongooseSchema } from "mongoose"
import type { Types } from "mongoose"

import type { TCreateEntity } from "@infrastructure/database/types/TCreateEntity"
import { isArray } from "@shared/functions/checks/isArray"
import { isNil } from "@shared/functions/checks/isNil"

@Schema({ _id: false, id: false, timestamps: false })
class CollectionTagRules {
  @Prop({
    type: [{ type: MongooseSchema.Types.ObjectId, ref: "Tag" }],
    required: true,
    default: [],
    validate: (value: Types.ObjectId[]) =>
      isArray(value) &&
      value.every((entry) => !isNil(entry)) &&
      new Set(value.map(String)).size === value.length,
  })
  all: Types.ObjectId[]

  @Prop({
    type: [{ type: MongooseSchema.Types.ObjectId, ref: "Tag" }],
    required: true,
    default: [],
    validate: (value: Types.ObjectId[]) =>
      isArray(value) &&
      value.every((entry) => !isNil(entry)) &&
      new Set(value.map(String)).size === value.length,
  })
  any: Types.ObjectId[]

  @Prop({
    type: [{ type: MongooseSchema.Types.ObjectId, ref: "Tag" }],
    required: true,
    default: [],
    validate: (value: Types.ObjectId[]) =>
      isArray(value) &&
      value.every((entry) => !isNil(entry)) &&
      new Set(value.map(String)).size === value.length,
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
