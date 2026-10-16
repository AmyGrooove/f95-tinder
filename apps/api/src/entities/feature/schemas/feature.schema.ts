import { EUnit } from "@entities/shared/schemas/EUnit"
import { EFeatureGroup } from "./EFeatureGroup"
import type { TCreateEntity } from "@infrastructure/database/types/TCreateEntity"
import { MongoEntity } from "@infrastructure/database/types/MongoEntity"
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"
import type { LanguageText } from "@entities/shared/schemas/languageText.schema"
import { LanguageTextSchema } from "@entities/shared/schemas/languageText.schema"
import { CAMEL_CASE_REGEX } from "@shared/static/CAMEL_CASE_REGEX"
import { EFeatureValueType } from "./EFeatureValueType"

@Schema({ collection: "Feature" })
class Feature extends MongoEntity {
  @Prop({ type: String, required: true, match: CAMEL_CASE_REGEX })
  key: string

  @Prop({ type: String, enum: Object.values(EFeatureGroup), default: null })
  group: EFeatureGroup | null

  @Prop({ type: LanguageTextSchema, required: true })
  name: LanguageText

  @Prop({ type: LanguageTextSchema, required: true, default: () => ({}) })
  description: LanguageText

  @Prop({
    type: String,
    enum: Object.values(EFeatureValueType),
    required: true,
  })
  valueType: EFeatureValueType

  @Prop({ type: String, enum: Object.values(EUnit), default: null })
  unit: EUnit | null
}

type TCreateFeature = TCreateEntity<Feature, "description" | "group" | "unit">

const FeatureSchema = SchemaFactory.createForClass(Feature)

FeatureSchema.index({ key: 1 }, { name: "featureKeyUnique", unique: true })

export { Feature, FeatureSchema }
export type { TCreateFeature }
