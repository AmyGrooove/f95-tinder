import type { TCreateEntity } from "@entities/shared/TCreateEntity"
import { MongoEntity } from "@entities/shared/MongoEntity"
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"
import type { LanguageText } from "@entities/shared/schemas/languageText.schema"
import { LanguageTextSchema } from "@entities/shared/schemas/languageText.schema"
import { EFeatureValueType } from "./EFeatureValueType"

@Schema({
  collection: "features",
  timestamps: true,
  versionKey: false,
  strict: true,
})
class Feature extends MongoEntity {
  @Prop({ type: String, required: true })
  key: string

  @Prop({ type: String, required: true })
  group: string

  @Prop({ type: LanguageTextSchema, required: true })
  name: LanguageText

  @Prop({ type: LanguageTextSchema, default: null })
  description: LanguageText | null

  @Prop({
    type: String,
    enum: Object.values(EFeatureValueType),
    required: true,
  })
  valueType: EFeatureValueType

  @Prop({ type: String, default: null })
  unit: string | null
}

type TCreateFeature = TCreateEntity<Feature, "description" | "unit">

const FeatureSchema = SchemaFactory.createForClass(Feature)

FeatureSchema.index({ key: 1 }, { name: "feature_key", unique: true })

export { Feature, FeatureSchema }
export type { TCreateFeature }
