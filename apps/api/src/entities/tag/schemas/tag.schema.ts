import { checkIsTagKeyAllowed } from "../functions/checkIsTagKeyAllowed"
import { checkIsNonEmptyStringArray } from "@entities/shared/functions/checks/checkIsNonEmptyStringArray"
import { ETagGroup } from "./ETagGroup"
import type { TCreateEntity } from "@infrastructure/database/types/TCreateEntity"
import { MongoEntity } from "@infrastructure/database/types/MongoEntity"
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"
import { CAMEL_CASE_REGEX } from "@shared/static/CAMEL_CASE_REGEX"
import type { LanguageText } from "@entities/shared/schemas/languageText.schema"
import { LanguageTextSchema } from "@entities/shared/schemas/languageText.schema"
import type { Embedding } from "@entities/shared/schemas/embedding.schema"
import { EmbeddingSchema } from "@entities/shared/schemas/embedding.schema"
import { isFiniteNumber } from "@shared/functions/checks/isFiniteNumber"
import { Schema as MongooseSchema } from "mongoose"
import type { Types } from "mongoose"
import { validateTagParents } from "../functions/validateTagParents"
import { validateTagParentsUpdate } from "../functions/validateTagParentsUpdate"
import { DICTIONARY } from "@entities/shared/static/DICTIONARY"

@Schema({ collection: "Tag" })
class Tag extends MongoEntity {
  @Prop({ type: String, required: true, match: CAMEL_CASE_REGEX })
  key: string

  @Prop({ type: String, enum: Object.values(ETagGroup), default: null })
  group: ETagGroup | null

  @Prop({ type: LanguageTextSchema, required: true })
  name: LanguageText

  @Prop({ type: LanguageTextSchema, required: true, default: () => ({}) })
  description: LanguageText

  @Prop({
    required: true,
    type: [String],
    default: [],
    validate: checkIsNonEmptyStringArray,
  })
  aliases: string[]

  @Prop({
    type: [{ type: MongooseSchema.Types.ObjectId, ref: "Tag" }],
    required: true,
    default: [],
    validate: function (this: Tag, parents: Types.ObjectId[]) {
      validateTagParents({ id: this._id, parents })

      return true
    },
  })
  parents: Types.ObjectId[]

  @Prop({ type: EmbeddingSchema, default: null })
  embedding: Embedding | null

  @Prop({
    type: Number,
    required: true,
    default: 1,
    min: 0,
    validate: isFiniteNumber,
  })
  weightModifier: number
}

type TCreateTag = TCreateEntity<
  Tag,
  | "group"
  | "description"
  | "aliases"
  | "parents"
  | "embedding"
  | "weightModifier"
>

const TagSchema = SchemaFactory.createForClass(Tag)

TagSchema.pre("validate", function () {
  if (!checkIsTagKeyAllowed({ key: this.key, group: this.group })) {
    this.invalidate("key", "Tag key does not match its group rule")
  }
})

TagSchema.pre("save", function () {
  validateTagParents({ id: this._id, parents: this.parents })

  if (this.isModified("parents")) {
    this.set("parents", [...this.parents])
    this.markModified("parents")
  }
})

TagSchema.pre(
  [
    "updateOne",
    "updateMany",
    "findOneAndUpdate",
    "replaceOne",
    "findOneAndReplace",
  ],
  function () {
    if (this.getOptions().upsert === true) {
      throw new Error(DICTIONARY.tag.unsupportedParentsWrite)
    }

    validateTagParentsUpdate({
      id: this.getFilter()._id,
      update: this.getUpdate(),
    })
  },
)

TagSchema.pre("insertMany", function (documents, options) {
  if (options?.lean === true) {
    throw new Error(DICTIONARY.tag.unsupportedParentsWrite)
  }

  for (const document of documents) {
    validateTagParents({ id: document._id, parents: document.parents })
  }
})

TagSchema.pre("bulkWrite", function (operations) {
  for (const operation of operations) {
    if ("insertOne" in operation) {
      const document = operation.insertOne.document

      validateTagParents({ id: document._id, parents: document.parents })
    }

    if ("replaceOne" in operation) {
      const { filter, replacement, upsert: isUpsert } = operation.replaceOne

      if (isUpsert === true) {
        throw new Error(DICTIONARY.tag.unsupportedParentsWrite)
      }

      validateTagParentsUpdate({
        id: replacement._id ?? filter._id,
        update: replacement,
      })
    }

    if ("updateOne" in operation || "updateMany" in operation) {
      const update =
        "updateOne" in operation ? operation.updateOne : operation.updateMany

      if (update.upsert === true) {
        throw new Error(DICTIONARY.tag.unsupportedParentsWrite)
      }

      validateTagParentsUpdate({ id: update.filter._id, update: update.update })
    }
  }
})

TagSchema.index({ key: 1 }, { name: "tagKeyUnique", unique: true })

export { Tag, TagSchema }
export type { TCreateTag }
